import type { UserProfile, DailyFormData, RepetitiveProcess, Bottleneck, Suggestion, ToolMapping } from "@/types/forms";

const KEY = {
  users: "hexa_users",
  currentUser: "hexa_current_user",
  daily: "hexa_daily",
  processes: "hexa_processes",
  bottlenecks: "hexa_bottlenecks",
  suggestions: "hexa_suggestions",
  toolMappings: "hexa_tool_mappings",
};

function get<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const store = {
  // Users
  getUsers: () => get<UserProfile>(KEY.users),
  saveUser: (user: UserProfile) => {
    const users = get<UserProfile>(KEY.users);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    set(KEY.users, users);
  },
  getCurrentUser: (): UserProfile | null => {
    try { return JSON.parse(localStorage.getItem(KEY.currentUser) || "null"); } catch { return null; }
  },
  setCurrentUser: (user: UserProfile | null) => {
    localStorage.setItem(KEY.currentUser, JSON.stringify(user));
  },
  login: (nome: string): UserProfile | null => {
    const users = get<UserProfile>(KEY.users);
    return users.find(u => u.nome.toLowerCase() === nome.toLowerCase()) || null;
  },

  // Daily
  getDailyForms: () => get<DailyFormData>(KEY.daily),
  saveDailyForm: (form: DailyFormData) => {
    const items = get<DailyFormData>(KEY.daily);
    items.push(form);
    set(KEY.daily, items);
  },

  // Processes
  getProcesses: () => get<RepetitiveProcess>(KEY.processes),
  saveProcess: (p: RepetitiveProcess) => {
    const items = get<RepetitiveProcess>(KEY.processes);
    items.push(p);
    set(KEY.processes, items);
  },

  // Bottlenecks
  getBottlenecks: () => get<Bottleneck>(KEY.bottlenecks),
  saveBottleneck: (b: Bottleneck) => {
    const items = get<Bottleneck>(KEY.bottlenecks);
    items.push(b);
    set(KEY.bottlenecks, items);
  },

  // Suggestions
  getSuggestions: () => get<Suggestion>(KEY.suggestions),
  saveSuggestion: (s: Suggestion) => {
    const items = get<Suggestion>(KEY.suggestions);
    items.push(s);
    set(KEY.suggestions, items);
  },

  // Tool Mappings
  getToolMappings: () => get<ToolMapping>(KEY.toolMappings),
  saveToolMapping: (t: ToolMapping) => {
    const items = get<ToolMapping>(KEY.toolMappings);
    items.push(t);
    set(KEY.toolMappings, items);
  },

  // Stats
  getStats: () => ({
    daily: get<DailyFormData>(KEY.daily),
    processes: get<RepetitiveProcess>(KEY.processes),
    bottlenecks: get<Bottleneck>(KEY.bottlenecks),
    suggestions: get<Suggestion>(KEY.suggestions),
    toolMappings: get<ToolMapping>(KEY.toolMappings),
  }),

  // Export
  exportAll: () => ({
    users: get<UserProfile>(KEY.users),
    daily: get<DailyFormData>(KEY.daily),
    processes: get<RepetitiveProcess>(KEY.processes),
    bottlenecks: get<Bottleneck>(KEY.bottlenecks),
    suggestions: get<Suggestion>(KEY.suggestions),
    toolMappings: get<ToolMapping>(KEY.toolMappings),
    exportedAt: new Date().toISOString(),
  }),
};
