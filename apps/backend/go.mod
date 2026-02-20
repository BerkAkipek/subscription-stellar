module github.com/BerkAkipek/subscription_stellar/backend

require github.com/BerkAkipek/subscription_stellar/stellar v0.0.0

require (
	github.com/go-chi/chi/v5 v5.2.5 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.8.0 // indirect
	github.com/jmoiron/sqlx v1.4.0 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.19 // indirect
	github.com/rs/zerolog v1.34.0 // indirect
	golang.org/x/sys v0.12.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)

replace github.com/BerkAkipek/subscription_stellar/stellar => ../../packages/stellar

go 1.25.5
