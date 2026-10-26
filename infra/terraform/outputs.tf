output "alb_dns_name" {
  description = "Apunta el registro DNS de la API (CNAME/alias) a este nombre."
  value       = aws_lb.api.dns_name
}

output "cloudfront_domain" {
  description = "Apunta el registro DNS del frontend a esta distribución."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "web_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.bucket
}

output "asg_name" {
  value = aws_autoscaling_group.api.name
}

output "github_deploy_role_arn" {
  description = "Guárdalo en GitHub como secreto AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}
