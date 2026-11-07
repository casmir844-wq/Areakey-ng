// Opt-in data logic only. Uses the alert_optins table; RLS limits everything to the signed-in person.
export async function listSettings(db) {
  const [areas, optins] = await Promise.all([
    db.from("areas").select("id,name").order("name"),
    db.from("alert_optins").select("area_id"),
  ]);
  if (areas.error) throw areas.error;
  if (optins.error) throw optins.error;
  const on = new Set(optins.data.map((o) => o.area_id));
  return areas.data.map((a) => ({ id: a.id, name: a.name, on: on.has(a.id) }));
}
export async function setAlerts(db, areaId, on) {
  if (on) { const { error } = await db.from("alert_optins").insert({ area_id: areaId }); if (error) throw error; return; }
  const { data: u } = await db.auth.getUser();
  const { error } = await db.from("alert_optins").delete().eq("area_id", areaId).eq("user_id", u.user.id);
  if (error) throw error;
}
