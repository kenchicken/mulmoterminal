<script setup lang="ts">
// The session-start repository chooser, shared by the single (chat) view's new-session
// modal and the grid cell's launch form so both offer the same list: the immediate
// subdirectories of the configured baseDir (GET /api/repos), one directory = one repo.
// Self-fetching (refreshed on every mount) so a newly-cloned repo appears without a
// reload. Touch-first sizing: full-width rows tall enough for a phone tap.
import { ref, computed, onMounted } from "vue";

const props = defineProps<{
  // Marks rows whose directory already has a live session (the grid's blue dot).
  isRunning?: (path: string) => boolean;
}>();

const emit = defineEmits<{
  // Fill/inspect without launching (grid: populates the dir field + resume lists).
  (e: "pick", path: string): void;
  // Start a session there now.
  (e: "launch", path: string): void;
}>();

interface RepoEntry {
  name: string;
  path: string;
  git: boolean;
}

const repos = ref<RepoEntry[]>([]);
const baseDir = ref<string | null>(null);
const loading = ref(true);
const error = ref(false);
const query = ref("");

onMounted(async () => {
  try {
    const res = await fetch("/api/repos");
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    repos.value = Array.isArray(body.repos) ? body.repos : [];
    baseDir.value = typeof body.baseDir === "string" ? body.baseDir : null;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return repos.value;
  return repos.value.filter((r) => r.name.toLowerCase().includes(q));
});
</script>

<template>
  <div class="flex w-full min-h-0 flex-col gap-1.5 font-sans">
    <p v-if="loading" class="m-0 text-[12px] text-dim">Loading repositories…</p>
    <p v-else-if="error" class="m-0 text-[12px] text-dim">Couldn't load the repository list.</p>
    <p v-else-if="!baseDir" class="m-0 text-[12px] text-dim">
      No base directory configured — set <code class="font-mono">baseDir</code> in ~/.mulmoterminal/config.json to list your repositories here.
    </p>
    <template v-else>
      <input
        v-if="repos.length > 8"
        v-model="query"
        data-testid="repo-filter"
        class="box-border w-full rounded-md border border-border bg-input px-2.5 py-[7px] font-sans text-[13px] text-fg focus:border-accent focus:outline-none"
        type="search"
        placeholder="Filter repositories…"
        spellcheck="false"
      />
      <div class="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-deep">
        <p v-if="!filtered.length" class="m-0 p-3 text-[12px] text-dim">No repository matches.</p>
        <div
          v-for="r in filtered"
          :key="r.path"
          data-testid="repo-row"
          class="flex items-stretch border-b border-b-border last:border-b-0"
          :class="{ 'is-running': props.isRunning?.(r.path) }"
        >
          <button
            type="button"
            data-testid="repo-row-pick"
            class="flex min-w-0 flex-auto cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2.5 text-left hover:bg-hover"
            :title="r.path"
            :aria-label="`Use ${r.name} — fill the launch form without starting`"
            @click="emit('pick', r.path)"
          >
            <span
              v-if="props.isRunning?.(r.path)"
              data-testid="repo-row-dot"
              class="inline-block h-1.5 w-1.5 flex-none rounded-full bg-[#3b82f6]"
              title="A session is already running here"
              aria-hidden="true"
            />
            <span class="truncate font-mono text-[13px]" :class="r.git ? 'text-fg' : 'text-dim'">{{ r.name }}</span>
            <span v-if="!r.git" class="flex-none rounded-[3px] bg-selected px-1 text-[9px] uppercase text-dim">dir</span>
          </button>
          <button
            type="button"
            data-testid="repo-row-launch"
            class="inline-flex flex-none cursor-pointer items-center border-0 border-l border-l-border bg-transparent px-3 text-secondary hover:bg-hover hover:text-fg"
            :title="props.isRunning?.(r.path) ? `${r.path} — a session is already running here in another terminal` : `Start a session in ${r.path}`"
            :aria-label="props.isRunning?.(r.path) ? `${r.name} — a session is already running here in another terminal` : `Start a session in ${r.name}`"
            @click="emit('launch', r.path)"
          >
            <span class="material-symbols-outlined text-[18px]">play_arrow</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
