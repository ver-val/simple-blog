FROM golang:1.23-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/blog-server ./cmd/server

FROM alpine:3.20
RUN adduser -D -h /app appuser
USER appuser
WORKDIR /app
COPY --from=builder /bin/blog-server /app/blog-server

EXPOSE 8080
ENTRYPOINT ["/app/blog-server"]
