import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, role, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

router.get('/export', role('PROFESSOR'), async (_req, res) => {
  const [students, subjects, subs] = await Promise.all([
    pool.query("SELECT id, name, email FROM users WHERE role='ALUNO' ORDER BY name"),
    pool.query('SELECT id, name, code FROM subjects ORDER BY name'),
    pool.query(
      `SELECT s.student_id, a.subject_id,
              COUNT(s.id)::int submitted,
              COUNT(s.score)::int graded,
              AVG(s.score / a.max_score * 10)::float avg_score
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       GROUP BY s.student_id, a.subject_id`
    ),
  ]);
  const subsMap = new Map(subs.rows.map((r: any) => [`${r.student_id}:${r.subject_id}`, r]));
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['Aluno;Email;Disciplina;Entregas;Corrigidas;Media (0-10)'];
  for (const u of students.rows) {
    for (const s of subjects.rows) {
      const g = subsMap.get(`${u.id}:${s.id}`);
      const avg = g?.avg !== null && g?.avg !== undefined ? round1(g.avg) : '';
      lines.push(
        [
          esc(u.name),
          esc(u.email),
          esc(s.name),
          g?.submitted || 0,
          g?.graded || 0,
          avg,
        ].join(';')
      );
    }
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="boletim-classhub.csv"');
  res.send('\ufeff' + lines.join('\r\n'));
});

router.get('/', async (req: AuthRequest, res) => {
  const subjects = await pool.query('SELECT id, name, code FROM subjects ORDER BY name');

  if (req.user!.role === 'ALUNO') {
    const uid = req.user!.id;
    const [assignments, progress] = await Promise.all([
      pool.query(
        `SELECT a.id, a.subject_id, a.title, a.due_date, a.max_score, s.score, s.submitted_at
         FROM assignments a
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
         ORDER BY a.due_date`,
        [uid]
      ),
      pool.query(
        `SELECT m.subject_id,
                COUNT(*)::int total,
                COUNT(mp.user_id)::int done
         FROM materials m
         LEFT JOIN material_progress mp ON mp.material_id = m.id AND mp.user_id = $1 AND mp.completed
         GROUP BY m.subject_id`,
        [uid]
      ),
    ]);

    const progMap = new Map(progress.rows.map((r: any) => [r.subject_id, r]));
    const now = Date.now();

    const subjectsOut = subjects.rows.map((s: any) => {
      const list = assignments.rows.filter((a: any) => a.subject_id === s.id);
      const graded = list.filter(
        (a: any) => a.score !== null && a.score !== undefined && a.max_score
      );
      const avg = graded.length
        ? round1(
            graded.reduce(
              (acc: number, a: any) => acc + (Number(a.score) / Number(a.max_score || 10)) * 10,
              0
            ) / graded.length
          )
        : null;
      const prog = progMap.get(s.id) || { total: 0, done: 0 };
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        avg,
        progress: { done: prog.done, total: prog.total, pct: prog.total ? Math.round((prog.done / prog.total) * 100) : null },
        assignments: list.map((a: any) => ({
          id: a.id,
          title: a.title,
          dueDate: a.due_date,
          maxScore: Number(a.max_score || 10),
          score: a.score !== null && a.score !== undefined ? Number(a.score) : null,
          submittedAt: a.submitted_at,
          status: a.submitted_at
            ? a.score !== null && a.score !== undefined
              ? 'GRADED'
              : 'SUBMITTED'
            : new Date(a.due_date).getTime() < now
              ? 'LATE'
              : 'PENDING',
        })),
      };
    });

    const allGraded = assignments.rows.filter(
      (a: any) => a.score !== null && a.score !== undefined && a.max_score
    );
    const overallAvg = allGraded.length
      ? round1(
          allGraded.reduce(
            (acc: number, a: any) => acc + (Number(a.score) / Number(a.max_score || 10)) * 10,
            0
          ) / allGraded.length
        )
      : null;
    const progTotals = [...progMap.values()].reduce(
      (acc, r) => ({ done: acc.done + r.done, total: acc.total + r.total }),
      { done: 0, total: 0 }
    );

    res.json({
      role: 'ALUNO',
      overall: {
        avg: overallAvg,
        progressPct: progTotals.total ? Math.round((progTotals.done / progTotals.total) * 100) : null,
        pending: subjectsOut.reduce(
          (acc, s) => acc + s.assignments.filter((a: any) => a.status === 'PENDING').length,
          0
        ),
        late: subjectsOut.reduce(
          (acc, s) => acc + s.assignments.filter((a: any) => a.status === 'LATE').length,
          0
        ),
      },
      subjects: subjectsOut,
    });
    return;
  }

  const [students, subs, assignmentsBySubject, pendingGrading] = await Promise.all([
    pool.query("SELECT id, name, email FROM users WHERE role='ALUNO' ORDER BY name"),
    pool.query(
      `SELECT s.student_id, a.subject_id,
              COUNT(s.id)::int submitted,
              COUNT(s.score)::int graded,
              AVG(s.score / a.max_score * 10)::float avg_score
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       GROUP BY s.student_id, a.subject_id`
    ),
    pool.query('SELECT subject_id, COUNT(*)::int total FROM assignments GROUP BY subject_id'),
    pool.query(
      `SELECT a.subject_id, COUNT(*)::int pending
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE s.score IS NULL
       GROUP BY a.subject_id`
    ),
  ]);

  const subsMap = new Map(subs.rows.map((r: any) => [`${r.student_id}:${r.subject_id}`, r]));
  const assignMap = new Map(assignmentsBySubject.rows.map((r: any) => [r.subject_id, r.total]));
  const pendMap = new Map(pendingGrading.rows.map((r: any) => [r.subject_id, r.pending]));

  res.json({
    role: 'PROFESSOR',
    subjects: subjects.rows.map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      assignments: assignMap.get(s.id) || 0,
      pendingGrading: pendMap.get(s.id) || 0,
    })),
    students: students.rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      grades: Object.fromEntries(
        subjects.rows.map((s: any) => {
          const g = subsMap.get(`${u.id}:${s.id}`);
          return [
            s.id,
            g
              ? { submitted: g.submitted, graded: g.graded, avg: g.avg !== null ? round1(g.avg) : null }
              : { submitted: 0, graded: 0, avg: null },
          ];
        })
      ),
    })),
  });
});

export default router;
