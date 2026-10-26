variable "region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "api_domain" {
  description = "Dominio de la API (p. ej. api.legrandhotel.pe). Necesita un certificado ACM validado."
  type        = string
}

variable "web_domain" {
  description = "Dominio del frontend (p. ej. app.legrandhotel.pe). Se usa en CORS (FRONTEND_URL)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "Certificado ACM (us-east-1) que cubre api_domain y web_domain."
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "asg_min" {
  type    = number
  default = 1
}

variable "asg_max" {
  type    = number
  default = 3
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

variable "enable_redis" {
  description = "ElastiCache Redis (EXTRA del 80%). false para ahorrar créditos y usar caché de archivo."
  type        = bool
  default     = true
}

variable "enable_nat" {
  description = "NAT Gateway (~USD 32/mes). Solo si la subred privada necesita salir a internet; apágalo después."
  type        = bool
  default     = false
}

variable "budget_email" {
  description = "Correo que recibe la alerta de presupuesto de USD 10."
  type        = string
}

variable "budget_limit_usd" {
  type    = string
  default = "10"
}

variable "github_repository" {
  description = "Repositorio que despliega vía OIDC, formato owner/repo."
  type        = string
  default     = "Josephml23/LeGrandHotel"
}

variable "api_image_tag" {
  description = "Tag inicial de la imagen (SHA del primer commit desplegado). Luego lo gestiona el pipeline en SSM."
  type        = string
  default     = "bootstrap"
}
