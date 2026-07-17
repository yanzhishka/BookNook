import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are missing');
}

const createTestClient = () => createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const firstClient = createTestClient();
const secondClient = createTestClient();
const password = `BookNook-${randomUUID()}-9a!`;
const acceptedAt = new Date().toISOString();
let firstDeleted = false;
let secondDeleted = false;

const deleteTestAccount = async (client) => {
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;
  const { error } = await client.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE_MY_ACCOUNT' },
  });
  if (error) throw error;
};

try {
  const firstSignup = await firstClient.auth.signUp({
    email: `booknook-release-${randomUUID()}@example.com`,
    password,
    options: { data: { name: 'Release Test One', terms_accepted_at: acceptedAt } },
  });
  if (firstSignup.error || !firstSignup.data.user) throw firstSignup.error;

  const secondSignup = await secondClient.auth.signUp({
    email: `booknook-release-${randomUUID()}@example.com`,
    password,
    options: { data: { name: 'Release Test Two', terms_accepted_at: acceptedAt } },
  });
  if (secondSignup.error || !secondSignup.data.user) throw secondSignup.error;

  const firstUserId = firstSignup.data.user.id;
  const secondUserId = secondSignup.data.user.id;
  const profileCheck = await firstClient
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', firstUserId)
    .single();
  if (profileCheck.error || !profileCheck.data.terms_accepted_at) throw profileCheck.error;

  const threadInsert = await secondClient
    .from('threads')
    .insert({
      title: 'Release verification',
      content: 'Temporary content for automated release verification.',
      author_id: secondUserId,
      author_name: 'Release Test Two',
    })
    .select('id')
    .single();
  if (threadInsert.error) throw threadInsert.error;

  const reportInsert = await firstClient.from('content_reports').insert({
    reporter_id: firstUserId,
    reported_user_id: secondUserId,
    content_type: 'thread',
    content_id: threadInsert.data.id,
    reason: 'spam',
  });
  if (reportInsert.error) throw reportInsert.error;

  const blockInsert = await firstClient.from('user_blocks').insert({
    blocker_id: firstUserId,
    blocked_id: secondUserId,
  });
  if (blockInsert.error) throw blockInsert.error;

  const hiddenThread = await firstClient
    .from('threads')
    .select('id')
    .eq('id', threadInsert.data.id);
  if (hiddenThread.error || hiddenThread.data.length !== 0) {
    throw hiddenThread.error || new Error('Blocked content is still visible');
  }

  await deleteTestAccount(firstClient);
  firstDeleted = true;
  await deleteTestAccount(secondClient);
  secondDeleted = true;

  console.log('Supabase release verification passed');
} finally {
  if (!firstDeleted) await deleteTestAccount(firstClient).catch(() => undefined);
  if (!secondDeleted) await deleteTestAccount(secondClient).catch(() => undefined);
}
