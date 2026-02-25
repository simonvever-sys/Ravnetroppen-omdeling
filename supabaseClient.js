const SUPABASE_URL = "https://znjfturgehkrdmrpyznt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XDkbhRsHq2fHCencH44MRQ_qxUhl1To";

(function initSupabase() {
  const hasLib = typeof window.supabase !== "undefined";
  const hasConfig =
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "__SUPABASE_URL__" &&
    SUPABASE_ANON_KEY !== "__SUPABASE_ANON_KEY__";

  if (!hasLib || !hasConfig) {
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
})();

window.isCloudEnabled = function isCloudEnabled() {
  return Boolean(window.supabaseClient);
};
