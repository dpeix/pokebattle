CREATE TABLE "abilities" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"generation_id" integer NOT NULL,
	"short_effect_fr" text,
	"short_effect_en" text,
	CONSTRAINT "abilities_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"category" text NOT NULL,
	"fling_power" integer,
	"short_effect_fr" text,
	"short_effect_en" text,
	CONSTRAINT "items_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "move_stat_changes" (
	"move_id" integer NOT NULL,
	"stat_id" integer NOT NULL,
	"change" integer NOT NULL,
	CONSTRAINT "move_stat_changes_move_id_stat_id_pk" PRIMARY KEY("move_id","stat_id")
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"generation_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"power" integer,
	"pp" integer NOT NULL,
	"accuracy" integer,
	"priority" integer NOT NULL,
	"damage_class" text NOT NULL,
	"target" text NOT NULL,
	"effect_chance" integer,
	"category" text,
	"ailment" text,
	"min_hits" integer,
	"max_hits" integer,
	"min_turns" integer,
	"max_turns" integer,
	"drain" integer,
	"healing" integer,
	"crit_rate" integer,
	"ailment_chance" integer,
	"flinch_chance" integer,
	"stat_chance" integer,
	"flags" text[] NOT NULL,
	"short_effect_fr" text,
	"short_effect_en" text,
	CONSTRAINT "moves_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "natures" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"increased_stat_id" integer,
	"decreased_stat_id" integer,
	CONSTRAINT "natures_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "pokemon" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"species_id" integer NOT NULL,
	"name_fr" text,
	"name_en" text,
	"is_default" boolean NOT NULL,
	"is_battle_only" boolean NOT NULL,
	"is_mega" boolean NOT NULL,
	"height" integer NOT NULL,
	"weight" integer NOT NULL,
	"hp" integer NOT NULL,
	"attack" integer NOT NULL,
	"defense" integer NOT NULL,
	"special_attack" integer NOT NULL,
	"special_defense" integer NOT NULL,
	"speed" integer NOT NULL,
	"type1_id" integer NOT NULL,
	"type2_id" integer,
	CONSTRAINT "pokemon_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "pokemon_abilities" (
	"pokemon_id" integer NOT NULL,
	"ability_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"is_hidden" boolean NOT NULL,
	CONSTRAINT "pokemon_abilities_pokemon_id_slot_pk" PRIMARY KEY("pokemon_id","slot")
);
--> statement-breakpoint
CREATE TABLE "pokemon_moves" (
	"pokemon_id" integer NOT NULL,
	"version_group_id" integer NOT NULL,
	"move_id" integer NOT NULL,
	"method" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "pokemon_moves_pokemon_id_version_group_id_move_id_method_level_pk" PRIMARY KEY("pokemon_id","version_group_id","move_id","method","level")
);
--> statement-breakpoint
CREATE TABLE "pokemon_species" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"generation_id" integer NOT NULL,
	"gender_rate" integer NOT NULL,
	"is_legendary" boolean NOT NULL,
	"is_mythical" boolean NOT NULL,
	CONSTRAINT "pokemon_species_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "stats" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	"is_battle_only" boolean NOT NULL,
	CONSTRAINT "stats_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "type_efficacy" (
	"attacking_type_id" integer NOT NULL,
	"defending_type_id" integer NOT NULL,
	"damage_factor" integer NOT NULL,
	CONSTRAINT "type_efficacy_attacking_type_id_defending_type_id_pk" PRIMARY KEY("attacking_type_id","defending_type_id")
);
--> statement-breakpoint
CREATE TABLE "types" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name_fr" text,
	"name_en" text,
	CONSTRAINT "types_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "version_groups" (
	"id" integer PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"generation_id" integer NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "version_groups_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
ALTER TABLE "move_stat_changes" ADD CONSTRAINT "move_stat_changes_move_id_moves_id_fk" FOREIGN KEY ("move_id") REFERENCES "public"."moves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_stat_changes" ADD CONSTRAINT "move_stat_changes_stat_id_stats_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."stats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moves" ADD CONSTRAINT "moves_type_id_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natures" ADD CONSTRAINT "natures_increased_stat_id_stats_id_fk" FOREIGN KEY ("increased_stat_id") REFERENCES "public"."stats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natures" ADD CONSTRAINT "natures_decreased_stat_id_stats_id_fk" FOREIGN KEY ("decreased_stat_id") REFERENCES "public"."stats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon" ADD CONSTRAINT "pokemon_species_id_pokemon_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."pokemon_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon" ADD CONSTRAINT "pokemon_type1_id_types_id_fk" FOREIGN KEY ("type1_id") REFERENCES "public"."types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon" ADD CONSTRAINT "pokemon_type2_id_types_id_fk" FOREIGN KEY ("type2_id") REFERENCES "public"."types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon_abilities" ADD CONSTRAINT "pokemon_abilities_pokemon_id_pokemon_id_fk" FOREIGN KEY ("pokemon_id") REFERENCES "public"."pokemon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon_abilities" ADD CONSTRAINT "pokemon_abilities_ability_id_abilities_id_fk" FOREIGN KEY ("ability_id") REFERENCES "public"."abilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon_moves" ADD CONSTRAINT "pokemon_moves_pokemon_id_pokemon_id_fk" FOREIGN KEY ("pokemon_id") REFERENCES "public"."pokemon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon_moves" ADD CONSTRAINT "pokemon_moves_version_group_id_version_groups_id_fk" FOREIGN KEY ("version_group_id") REFERENCES "public"."version_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pokemon_moves" ADD CONSTRAINT "pokemon_moves_move_id_moves_id_fk" FOREIGN KEY ("move_id") REFERENCES "public"."moves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_efficacy" ADD CONSTRAINT "type_efficacy_attacking_type_id_types_id_fk" FOREIGN KEY ("attacking_type_id") REFERENCES "public"."types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_efficacy" ADD CONSTRAINT "type_efficacy_defending_type_id_types_id_fk" FOREIGN KEY ("defending_type_id") REFERENCES "public"."types"("id") ON DELETE no action ON UPDATE no action;