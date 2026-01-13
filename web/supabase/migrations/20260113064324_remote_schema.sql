drop policy "Admins can view all llm_interactions" on "public"."llm_interactions";

drop policy "Service role can insert llm_interactions" on "public"."llm_interactions";

revoke delete on table "public"."llm_interactions" from "anon";

revoke insert on table "public"."llm_interactions" from "anon";

revoke references on table "public"."llm_interactions" from "anon";

revoke select on table "public"."llm_interactions" from "anon";

revoke trigger on table "public"."llm_interactions" from "anon";

revoke truncate on table "public"."llm_interactions" from "anon";

revoke update on table "public"."llm_interactions" from "anon";

revoke delete on table "public"."llm_interactions" from "authenticated";

revoke insert on table "public"."llm_interactions" from "authenticated";

revoke references on table "public"."llm_interactions" from "authenticated";

revoke select on table "public"."llm_interactions" from "authenticated";

revoke trigger on table "public"."llm_interactions" from "authenticated";

revoke truncate on table "public"."llm_interactions" from "authenticated";

revoke update on table "public"."llm_interactions" from "authenticated";

revoke delete on table "public"."llm_interactions" from "service_role";

revoke insert on table "public"."llm_interactions" from "service_role";

revoke references on table "public"."llm_interactions" from "service_role";

revoke select on table "public"."llm_interactions" from "service_role";

revoke trigger on table "public"."llm_interactions" from "service_role";

revoke truncate on table "public"."llm_interactions" from "service_role";

revoke update on table "public"."llm_interactions" from "service_role";

alter table "public"."llm_interactions" drop constraint "llm_interactions_trigger_type_check";

alter table "public"."llm_interactions" drop constraint "llm_interactions_user_id_fkey";

alter table "public"."llm_interactions" drop constraint "llm_interactions_pkey";

drop index if exists "public"."idx_llm_interactions_cost";

drop index if exists "public"."idx_llm_interactions_provider";

drop index if exists "public"."idx_llm_interactions_session";

drop index if exists "public"."idx_llm_interactions_timestamp";

drop index if exists "public"."idx_llm_interactions_trigger";

drop index if exists "public"."idx_llm_interactions_user_date";

drop index if exists "public"."llm_interactions_pkey";

drop table "public"."llm_interactions";


