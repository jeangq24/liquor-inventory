CREATE SCHEMA IF NOT EXISTS "inventory";--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "inventory"."movement_type" AS ENUM('IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RESERVATION', 'RELEASE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "inventory"."reservation_status" AS ENUM('ACTIVE', 'RELEASED', 'DISPATCHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "inventory"."stock_return_status" AS ENUM('RECEIVED', 'PROCESSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_stock_balances_on_hand" CHECK ("inventory"."stock_balances"."quantity_on_hand" >= 0),
	CONSTRAINT "chk_stock_balances_reserved" CHECK ("inventory"."stock_balances"."quantity_reserved" >= 0),
	CONSTRAINT "chk_stock_balances_available" CHECK ("inventory"."stock_balances"."quantity_reserved" <= "inventory"."stock_balances"."quantity_on_hand")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"reservation_id" uuid,
	"stock_return_id" uuid,
	"order_id" uuid,
	"movement_type" "inventory"."movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" varchar(180) NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"performed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "chk_stock_movements_quantity" CHECK ("inventory"."stock_movements"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_reservation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reservation_items_quantity" CHECK ("inventory"."stock_reservation_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"status" "inventory"."reservation_status" DEFAULT 'ACTIVE' NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"reserved_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_reservations_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "chk_stock_reservations_timestamps" CHECK (("inventory"."stock_reservations"."status" <> 'RELEASED' OR "inventory"."stock_reservations"."released_at" IS NOT NULL) AND ("inventory"."stock_reservations"."status" <> 'DISPATCHED' OR "inventory"."stock_reservations"."dispatched_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_return_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity_received" integer NOT NULL,
	"quantity_restockable" integer DEFAULT 0 NOT NULL,
	"reason" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_stock_return_items_received" CHECK ("inventory"."stock_return_items"."quantity_received" > 0),
	CONSTRAINT "chk_stock_return_items_restockable" CHECK ("inventory"."stock_return_items"."quantity_restockable" >= 0 AND "inventory"."stock_return_items"."quantity_restockable" <= "inventory"."stock_return_items"."quantity_received")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."stock_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"delivery_attempt_id" uuid,
	"idempotency_key" varchar(180) NOT NULL,
	"reason" varchar(180) NOT NULL,
	"status" "inventory"."stock_return_status" DEFAULT 'RECEIVED' NOT NULL,
	"received_by" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_returns_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "chk_stock_returns_processed" CHECK ("inventory"."stock_returns"."status" <> 'PROCESSED' OR "inventory"."stock_returns"."processed_at" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_balances_location_id_inventory_locations_id_fk' AND conrelid = 'inventory.stock_balances'::regclass) THEN
		ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_location_id_inventory_locations_id_fk' AND conrelid = 'inventory.stock_movements'::regclass) THEN
		ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_reservation_id_stock_reservations_id_fk' AND conrelid = 'inventory.stock_movements'::regclass) THEN
		ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_reservation_id_stock_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "inventory"."stock_reservations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_stock_return_id_stock_returns_id_fk' AND conrelid = 'inventory.stock_movements'::regclass) THEN
		ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_stock_return_id_stock_returns_id_fk" FOREIGN KEY ("stock_return_id") REFERENCES "inventory"."stock_returns"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservation_items_reservation_id_stock_reservations_id_fk' AND conrelid = 'inventory.stock_reservation_items'::regclass) THEN
		ALTER TABLE "inventory"."stock_reservation_items" ADD CONSTRAINT "stock_reservation_items_reservation_id_stock_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "inventory"."stock_reservations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservations_location_id_inventory_locations_id_fk' AND conrelid = 'inventory.stock_reservations'::regclass) THEN
		ALTER TABLE "inventory"."stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_return_items_stock_return_id_stock_returns_id_fk' AND conrelid = 'inventory.stock_return_items'::regclass) THEN
		ALTER TABLE "inventory"."stock_return_items" ADD CONSTRAINT "stock_return_items_stock_return_id_stock_returns_id_fk" FOREIGN KEY ("stock_return_id") REFERENCES "inventory"."stock_returns"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_returns_location_id_inventory_locations_id_fk' AND conrelid = 'inventory.stock_returns'::regclass) THEN
		ALTER TABLE "inventory"."stock_returns" ADD CONSTRAINT "stock_returns_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_balances_location_variant" ON "inventory"."stock_balances" USING btree ("location_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_balances_variant" ON "inventory"."stock_balances" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_balances_location" ON "inventory"."stock_balances" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_variant_date" ON "inventory"."stock_movements" USING btree ("variant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_order" ON "inventory"."stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_location_date" ON "inventory"."stock_movements" USING btree ("location_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_reservation" ON "inventory"."stock_movements" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_return" ON "inventory"."stock_movements" USING btree ("stock_return_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reservation_items_variant" ON "inventory"."stock_reservation_items" USING btree ("reservation_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reservation_items_variant" ON "inventory"."stock_reservation_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_reservations_active_order" ON "inventory"."stock_reservations" USING btree ("order_id") WHERE "inventory"."stock_reservations"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_reservations_order" ON "inventory"."stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_reservations_location" ON "inventory"."stock_reservations" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_return_items_variant" ON "inventory"."stock_return_items" USING btree ("stock_return_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_return_items_variant" ON "inventory"."stock_return_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_returns_order" ON "inventory"."stock_returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_returns_location" ON "inventory"."stock_returns" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_returns_delivery_attempt" ON "inventory"."stock_returns" USING btree ("delivery_attempt_id");