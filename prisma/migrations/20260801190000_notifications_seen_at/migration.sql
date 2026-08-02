-- The bell in the top bar becomes real. Events are DERIVED from rows that already
-- exist (proposals viewed/accepted, call-queue leads due) — no notifications
-- table and no fabricated feed. The one piece of state a real unread badge needs
-- is "when did he last look", which is this column. Additive and nullable:
-- null = never opened, which correctly renders everything recent as unread.
ALTER TABLE "User" ADD COLUMN "notificationsSeenAt" TIMESTAMP(3);
