FROM alpine:latest

# Install curl
RUN apk add --no-cache curl

# Copy cron script
COPY crontab /etc/crontabs/root

# Run cron in foreground
CMD ["crond", "-f", "-l", "2"]
