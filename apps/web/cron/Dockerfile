FROM alpine:latest

# Install curl and create non-root user
RUN apk add --no-cache curl && \
    addgroup -g 1001 crongroup && \
    adduser -D -u 1001 -G crongroup cronuser

# Copy cron script to user-specific location
COPY crontab /var/spool/cron/crontabs/cronuser

# Set proper permissions
RUN chown cronuser:crongroup /var/spool/cron/crontabs/cronuser && \
    chmod 0600 /var/spool/cron/crontabs/cronuser

# Switch to non-root user
USER cronuser

# Run cron in foreground
CMD ["crond", "-f", "-l", "2"]
