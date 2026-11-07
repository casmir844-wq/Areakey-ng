// Emergency data logic only. No page markup here.
export async function myHouses(db) {
  const { data: u } = await db.auth.getUser();
  const { data, error } = await db.from("house_members").select("house_id, houses(label, area_id)").eq("user_id", u.user.id);
  if (error) throw error;
  return data.filter((r) => r.houses).map((r) => ({ id: r.house_id, label: r.houses.label, areaId: r.houses.area_id }));
}
export async function raiseEmergency(db, { houseId, areaId, kind, note }) {
  const { error } = await db.from("emergency_alerts").insert({ house_id: houseId, area_id: areaId, kind, note: note || null });
  if (error) throw error;
}
export async function fetchAlerts(db) { const { data, error } = await db.rpc("get_my_alerts"); if (error) throw error; return data; }
export async function resolveAlert(db, id) { const { error } = await db.from("emergency_alerts").update({ status: "resolved" }).eq("id", id); if (error) throw error; }
export async function deleteAlert(db, id) { const { error } = await db.from("emergency_alerts").delete().eq("id", id); if (error) throw error; }
export async function getOptIn(db, areaId) { const { data, error } = await db.from("alert_optins").select("area_id").eq("area_id", areaId); if (error) throw error; return data.length > 0; }
export async function setOptIn(db, areaId, on) {
  const { data: u } = await db.auth.getUser();
  const q = on ? db.from("alert_optins").insert({ area_id: areaId }) : db.from("alert_optins").delete().eq("area_id", areaId).eq("user_id", u.user.id);
  const { error } = await q; if (error) throw error;
}
