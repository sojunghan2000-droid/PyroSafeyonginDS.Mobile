import { NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = admin();
  const t = today();
  const { data } = await db.from("inspection_tasks").select("*")
    .neq("status", "Completed").order("due_date", { ascending: true });
  const items = (data ?? [])
    .filter((r) => !r.excluded)
    .map((r) => {
      const due = String(r.due_date).slice(0, 10);
      const urgency = due < t ? "지연" : due === t ? "오늘" : "예정";
      return {
        id: r.task_id, label: r.equipment_label, taskType: r.task_type,
        floor: r.floor, zone: r.zone, dueDate: due, roundId: r.round_id, urgency,
      };
    });
  return NextResponse.json({ items });
}
