# LeGrandHotel en AWS (us-east-1). Ver infra/README.md antes de aplicar: varios recursos cobran.
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # Recomendado: estado remoto en S3 con bloqueo (descomentar tras crear el bucket).
  # backend "s3" {
  #   bucket       = "legrandhotel-tfstate-<cuenta>"
  #   key          = "prod/terraform.tfstate"
  #   region       = "us-east-1"
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "LeGrandHotel"
      Environment = var.environment
      Course      = "Desarrollo de Soluciones en la Nube - TECSUP"
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront solo acepta certificados de us-east-1 (misma región en este proyecto).
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }

locals {
  name = "legrandhotel-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
