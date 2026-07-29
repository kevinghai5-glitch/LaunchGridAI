-- Phase 2. Per-client overrides for the 14 GoHighLevel workflows the build
-- installs, as { [workflowId]: boolean }. Additive and nullable.
--
-- ONLY the operator's explicit decisions live here, never the resolved set. Every
-- workflow already carries a default and an applicability rule; storing the full
-- resolved map would freeze today's defaults into every existing client, so
-- changing a default later would silently skip everyone who never touched it. An
-- absent key means "no opinion — use the rule".
ALTER TABLE "Business" ADD COLUMN "workflowToggles" JSONB;
