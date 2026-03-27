// ─────────────────────────────────────────────
// SUPABASE CONFIG
// ─────────────────────────────────────────────
const SB = 'https://cpbbnfychuyojvxhtiel.supabase.co';
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYmJuZnljaHV5b2p2eGh0aWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDYzMjgsImV4cCI6MjA4ODg4MjMyOH0.9dpg6BpvAGADZWhivxvJbd2sJUpyj9hgety7BTjHazM';
const TABLES = ['groups','templates','operators','sessions'];

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const D = { groups: [], templates: [], operators: [], sessions: [] };
let APP_USER = null; // { id, sicil, name, role:'admin'|'operator' }

function _authHeader() {
  return { 'apikey': SK, 'Authorization': 'Bearer ' + SK, 'Content-Type': 'application/json' };
}
