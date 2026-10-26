# ── CloudWatch: logs JSON centralizados, consultas guardadas y alarmas ──
resource "aws_cloudwatch_log_group" "api" {
  name              = "/legrandhotel/api"
  retention_in_days = 30
}

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alertas"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.budget_email
}

resource "aws_cloudwatch_query_definition" "errors_5xx" {
  name            = "LeGrandHotel/Errores 5xx"
  log_group_names = [aws_cloudwatch_log_group.api.name]
  query_string    = <<-EOT
    fields @timestamp, context.request_id, context.route, context.status, context.duration_ms, message
    | filter context.status >= 500 or level_name = "ERROR"
    | sort @timestamp desc
    | limit 100
  EOT
}

resource "aws_cloudwatch_query_definition" "slow" {
  name            = "LeGrandHotel/Peticiones lentas (>800 ms)"
  log_group_names = [aws_cloudwatch_log_group.api.name]
  query_string    = <<-EOT
    fields @timestamp, context.route, context.duration_ms, context.user_id
    | filter context.duration_ms > 800
    | stats count(*) as lentas, avg(context.duration_ms) as promedio, pct(context.duration_ms, 95) as p95 by context.route
    | sort lentas desc
  EOT
}

resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "${local.name}-cpu-alta"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { AutoScalingGroupName = aws_autoscaling_group.api.name }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "errors_5xx" {
  alarm_name          = "${local.name}-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = aws_lb.api.arn_suffix }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "latency" {
  alarm_name          = "${local.name}-latencia-p95"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0.8
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = aws_lb.api.arn_suffix }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "unhealthy" {
  alarm_name          = "${local.name}-instancias-caidas"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ── Alerta de presupuesto en USD 10 desde el primer día ──
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-mensual"
  budget_type  = "COST"
  limit_amount = var.budget_limit_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}
