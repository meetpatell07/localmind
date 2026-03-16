CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" varchar(200),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"linkedin" varchar(500),
	"portfolio_web" varchar(500),
	"instagram" varchar(200),
	"x_handle" varchar(200),
	"facebook" varchar(500),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
