# ── RDS MySQL 8 en subred privada, cifrada, con snapshots automáticos de 7 días ──
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "mysql" {
  name   = "${local.name}-mysql8"
  family = "mysql8.0"

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
  engine_version                  = "8.0"
  instance_class                  = var.db_instance_class
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
resource "aws_ssm_parameter" "env" {
  for_each = {
    APP_ENV           = "production"
    APP_DEBUG         = "false"
    APP_URL           = "https://${var.api_domain}"
    FRONTEND_URL      = "https://${var.web_domain}"
    LOG_CHANNEL       = "stack"
    LOG_STACK         = "json"
    LOG_JSON_STREAM   = "/var/www/html/storage/logs/laravel.json"
    DB_CONNECTION     = "mysql"
    DB_HOST           = aws_db_instance.main.address
    DB_PORT           = "3306"
    DB_DATABASE       = "legrandhotel"
    DB_USERNAME       = "legrandhotel"
    CACHE_STORE       = var.enable_redis ? "redis" : "file"
    QUEUE_CONNECTION  = var.enable_redis ? "redis" : "database"
    REDIS_HOST        = var.enable_redis ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : ""
    SANCTUM_EXPIRATION = "60"
    BACKUP_BUCKET     = aws_s3_bucket.backups.bucket
  }
  name  = "/legrandhotel/${var.environment}/${each.key}"
  type  = "String"
  value = each.value
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/legrandhotel/${var.environment}/DB_PASSWORD"
  type  = "SecureString"
  value = random_password.db.result
}

# APP_KEY y GOOGLE_CLIENT_SECRET se cargan a mano (no quedan en el estado de Terraform):
#   aws ssm put-parameter --name /legrandhotel/prod/APP_KEY --type SecureString --value "base64:..."
#   aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_ID --type String --value "..."
#   aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_SECRET --type SecureString --value "..."
