import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault()
});

const db = getFirestore();
const auth = getAuth();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function upsertAuthUser(email: string, password: string, displayName: string) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName });
    return user.uid;
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code !== "auth/user-not-found") throw error;
    const created = await auth.createUser({ email, password, displayName });
    return created.uid;
  }
}

async function run() {
  const rootEmail = "userroot@paysync.com";
  const ownerEmail = "usercobrador@paysync.com";
  const password = "1234561a";

  const [rootUid, ownerUid] = await Promise.all([
    upsertAuthUser(rootEmail, password, "Root Admin"),
    upsertAuthUser(ownerEmail, password, "Demo Owner")
  ]);

  await db.doc(`users/${rootUid}`).set(
    {
      email: rootEmail,
      displayName: "Root Admin",
      platformRole: "root",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.doc(`users/${ownerUid}`).set(
    {
      email: ownerEmail,
      displayName: "Demo Owner",
      platformRole: "user",
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const academyRef = db.collection("academies").doc("academy_demo");
  await academyRef.set(
    {
      name: "Academia Demo PaySync",
      slug: `${slugify("Academia Demo PaySync")}-demo`,
      plan: "pro",
      planLimits: {
        maxStudents: 100
      },
      status: "active",
      owner: {
        uid: ownerUid,
        name: "Demo Owner",
        email: ownerEmail
      },
      counters: {
        students: 2,
        fees: 2,
        payments: 1
      },
      trial: {
        active: false
      },
      subscription: {
        active: true,
        mrr: 99
      },
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.doc(`academies/${academyRef.id}/users/${ownerUid}`).set(
    {
      userId: ownerUid,
      email: ownerEmail,
      role: "owner",
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const studentA = db.collection(`academies/${academyRef.id}/students`).doc("student_a");
  const studentB = db.collection(`academies/${academyRef.id}/students`).doc("student_b");
  await Promise.all([
    studentA.set(
      {
        fullName: "Lucia Perez",
        email: "lucia@example.com",
        phone: "+54 11 5555 1111",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    ),
    studentB.set(
      {
        fullName: "Carlos Medina",
        email: "carlos@example.com",
        phone: "+54 11 5555 2222",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    )
  ]);

  await db.doc(`academies/${academyRef.id}/fees/fee_a`).set(
    {
      studentId: "student_a",
      concept: "Mensualidad marzo",
      amount: 15000,
      dueDate: "2026-03-10",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.doc(`academies/${academyRef.id}/payments/payment_a`).set(
    {
      studentId: "student_b",
      feeId: "",
      amount: 12000,
      paymentDate: "2026-03-05",
      method: "transfer",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // eslint-disable-next-line no-console
  console.log("Seed completado.");
  // eslint-disable-next-line no-console
  console.log(`Root: ${rootEmail} / ${password}`);
  // eslint-disable-next-line no-console
  console.log(`Owner demo: ${ownerEmail} / ${password}`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Seed falló:", error);
  process.exit(1);
});
