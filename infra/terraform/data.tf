# ── RDS MySQL 8.4 en subred privada, cifrada, con snapshots automáticos de 7 días ──
# 8.4 (LTS) y no 8.0: el soporte estándar de 8.0 en RDS terminó en julio de 2026 y desde entonces
# AWS cobra "Extended Support" por vCPU-hora (más que la propia db.t3.micro). Además es la misma
# versión que usa docker-compose.yml en local (mysql:8.4).
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "mysql" {
  name   = "${local.name}-mysql84"
  family = "mysql8.4"

  parameter {
    name  = "slow_query_log"
    value = "1"
  }
  parameter {
    name  = "long_query_time"
    value = "0.5"
  }
}

resource "aws_db_instance" "main" {
  identifier                      = "${local.name}-mysql"
  engine                          = "mysql"
  engine_version                  = "8.4"
  instance_class                  = var.db_instance_class
  # Nunca pasar solo a Extended Support (cobra aparte) cuando la versión deje de tener soporte estándar.
  engine_lifecycle_support        = "open-source-rds-extended-support-disabled"
  allocated_storage               = 20
  max_allocated_storage           = 50
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "legrandhotel"
  username                        = "legrandhotel"
  password                        = random_password.db.result
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.db.id]
  parameter_group_name            = aws_db_parameter_group.mysql.name
  publicly_accessible             = false
  multi_az                        = false
  backup_retention_period         = 7
  backup_window                   = "08:00-08:30" # 03:00 hora de Lima
  maintenance_window              = "sun:09:00-sun:10:00"
  copy_tags_to_snapshot           = true
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name}-mysql-final"
  enabled_cloudwatch_logs_exports = ["error", "slowquery"]
  auto_minor_version_upgrade      = true
}

# ── ElastiCache Redis: caché, rate limit y colas (EXTRA del 80%) ──
resource "aws_elasticache_subnet_group" "main" {
  count      = var.enable_redis ? 1 : 0
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  count                = var.enable_redis ? 1 : 0
  cluster_id           = "${local.name}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main[0].name
  security_group_ids   = [aws_security_group.redis.id]
  snapshot_retention_limit = 1
}

# ── S3 de respaldos: mysqldump diario con versionado y ciclo de vida ──
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name}-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "rotar-respaldos"
    status = "Enabled"
    filter { prefix = "mysql/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    expiration { days = 90 }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

# ── Secretos y variables de producción en SSM Parameter Store ──
# Las mismas variables que Render (render.yaml) y api/.env.example, adaptadas a AWS. Las que la API lee
# con env() en api/config/ y no aparecen aquí usan su valor por defecto, que sirve para producción.
locals {
  # FRONTEND_URL: el primero es la web oficial (a ella vuelve el login con Google, App\Support\Frontend);
  # los demás solo se agregan a CORS (p. ej. la web de Render mientras dura la migración).
  # La app móvil (Flutter, Android/iOS) NO necesita CORS: no es un navegador y no envía Origin.
  frontend_origins = join(",", concat(["https://${var.web_domain}"], var.extra_frontend_origins))

  ssm_env = merge(tomap({
    APP_NAME            = "LeGrandHotel"
    APP_ENV             = "production"
    APP_DEBUG           = "false"
    APP_URL             = "https://${var.api_domain}"
    APP_LOCALE          = "es" # sin esto config/app.php cae en "en"
    APP_FALLBACK_LOCALE = "en"
    APP_TIMEZONE        = "America/Lima"
    # config/hotel.php muestra la plataforma en la vista del Programador: AWS si existe esta variable.
    AWS_EXECUTION_ENV   = "AWS_EC2_legrandhotel"
    FRONTEND_URL        = local.frontend_origins
    LOG_CHANNEL         = "stack"
    LOG_STACK           = "json"
    LOG_REQUEST_CHANNEL = "json"
    LOG_LEVEL           = "info"
    LOG_JSON_STREAM     = "/var/www/html/storage/logs/laravel.json"
    DB_CONNECTION       = "mysql"
    DB_HOST             = aws_db_instance.main.address
    DB_PORT             = "3306"
    DB_DATABASE         = "legrandhotel"
    DB_USERNAME         = "legrandhotel"
    DB_TIMEOUT          = "3"
    # Sin Redis la caché va a la BD (tablas cache y cache_locks) y no a archivo: así el bloqueo de login
    # tras 3 intentos y los límites por minuto se comparten entre las instancias del ASG.
    CACHE_STORE         = var.enable_redis ? "redis" : "database"
    QUEUE_CONNECTION    = var.enable_redis ? "redis" : "database"
    SESSION_DRIVER      = "array" # API sin sesiones (tokens de Sanctum)
    MAIL_MAILER         = "log"
    SANCTUM_EXPIRATION  = "60"
    BCRYPT_ROUNDS       = "12"
    RATE_LIMIT_LOGIN    = tostring(var.rate_limit_login)
    RATE_LIMIT_REGISTER = tostring(var.rate_limit_register)
    RATE_LIMIT_API      = tostring(var.rate_limit_api)
    BACKUP_BUCKET       = aws_s3_bucket.backups.bucket
    }),
    # SSM no acepta valores vacíos: REDIS_HOST solo existe si hay Redis.
    var.enable_redis ? tomap({ REDIS_HOST = aws_elasticache_cluster.redis[0].cache_nodes[0].address }) : tomap({})
  )
}

resource "aws_ssm_parameter" "env" {
  for_each = local.ssm_env
  name     = "/legrandhotel/${var.environment}/${each.key}"
  type     = "String"
  value    = each.value
}

# Sembrar las cuentas y datos de demostración (DemoSeeder) al arrancar una instancia. Se cambia a mano,
# como en Render: "true", instance refresh, y de vuelta a "false". Terraform no pisa el valor.
resource "aws_ssm_parameter" "run_seed" {
  name  = "/legrandhotel/${var.environment}/RUN_SEED"
  type  = "String"
  value = "false"
  lifecycle { ignore_changes = [value] }
}

# Imagen que arrancan las instancias. El pipeline la actualiza en cada despliegue (y en el rollback).
resource "aws_ssm_parameter" "api_image" {
  name  = "/legrandhotel/${var.environment}/API_IMAGE"
  type  = "String"
  value = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/legrandhotel/${var.environment}/DB_PASSWORD"
  type  = "SecureString"
  value = random_password.db.result
}

# Secretos que se cargan a mano (no quedan en el estado de Terraform). Sin APP_KEY la API no arranca.
# Ningún valor puede llevar comilla simple (') : user_data los escribe entre comillas simples en .env.
#   aws ssm put-parameter --name /legrandhotel/prod/APP_KEY --type SecureString --value "base64:..."
#   aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_ID --type String --value "..."
#   aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_SECRET --type SecureString --value "..."
#   aws ssm put-parameter --name /legrandhotel/prod/DEMO_PASSWORD --type SecureString --value "..."
# DEMO_PASSWORD solo hace falta para sembrar las cuentas de demostración (RUN_SEED=true). Si falta,
# user_data NO siembra: el DemoSeeder usaría la contraseña por defecto, que está publicada en el repositorio.
