"use client";
import { create } from "zustand";
import type { Clip, ProjectData, Scene, Track } from "@/lib/types";
import { clamp, uid } from "@/lib/utils";
import { recalcSceneTimes, buildTimelineFromScenes } from "@/lib/ai/sceneBuilder";

interface Snapshot {
  scenes: Scene[];
  timeline: Track[];
  captionStyle: ProjectData["captionStyle"];
  musicMood: ProjectData["musicMood"];
  title: string;
}

interface EditorState {
  project: ProjectData | null;
  selectedClipId: string | null;
  selectedSceneId: string | null;
  playhead: number;
  zoom: number; // px per second
  snap: boolean;
  playing: boolean;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;

  loadProject: (p: ProjectData) => void;
  replaceProject: (p: ProjectData) => void;
  setPlayhead: (t: number) => void;
  setZoom: (z: number) => void;
  toggleSnap: () => void;
  setPlaying: (v: boolean) => void;
  selectClip: (id: string | null) => void;
  selectScene: (id: string | null) => void;
  markSaved: () => void;

  patchProject: (patch: Partial<ProjectData>, history?: boolean) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  removeSceneAt: (index: number) => void;
  rebuildTimeline: () => void;

  addClip: (trackId: string, partial: Partial<Clip>) => Clip | null;
  updateClip: (id: string, patch: Partial<Clip>, history?: boolean) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  splitClipAt: (id: string, time: number) => void;
  setTrackMuted: (trackId: string, muted: boolean) => void;

  undo: () => void;
  redo: () => void;
  projectDuration: () => number;
}

const snap = (p: ProjectData): Snapshot => structuredClone({
  scenes: p.scenes, timeline: p.timeline, captionStyle: p.captionStyle, musicMood: p.musicMood, title: p.title,
});

export const useEditor = create<EditorState>((set, get) => {
  const pushHistory = () => {
    const { project, past } = get();
    if (!project) return;
    const next = [...past, snap(project)].slice(-60);
    set({ past: next, future: [], dirty: true });
  };

  const commit = (mutate: (p: ProjectData) => ProjectData, history = true) => {
    const { project } = get();
    if (!project) return;
    if (history) pushHistory();
    set({ project: mutate(project), dirty: true });
  };

  return {
    project: null,
    selectedClipId: null,
    selectedSceneId: null,
    playhead: 0,
    zoom: 14,
    snap: true,
    playing: false,
    past: [],
    future: [],
    dirty: false,

    loadProject: (p) => set({ project: p, past: [], future: [], playhead: 0, selectedClipId: null, selectedSceneId: null, dirty: false, playing: false }),
    replaceProject: (p) => { pushHistory(); set({ project: p, dirty: true }); },
    setPlayhead: (t) => set({ playhead: t }),
    setZoom: (z) => set({ zoom: clamp(z, 4, 60) }),
    toggleSnap: () => set((s) => ({ snap: !s.snap })),
    setPlaying: (v) => set({ playing: v }),
    selectClip: (id) => set({ selectedClipId: id, selectedSceneId: null }),
    selectScene: (id) => set({ selectedSceneId: id, selectedClipId: null }),
    markSaved: () => set({ dirty: false }),

    patchProject: (patch, history = true) => commit((p) => ({ ...p, ...patch }), history),

    updateScene: (id, patch) =>
      commit((p) => {
        const durChanged = patch.duration !== undefined;
        let scenes = p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
        if (durChanged) scenes = recalcSceneTimes(scenes);
        const timeline = durChanged ? buildTimelineFromScenes(scenes, p.musicMood) : p.timeline;
        return { ...p, scenes, timeline };
      }),

    removeSceneAt: (index) =>
      commit((p) => {
        if (p.scenes.length <= 1) return p;
        const scenes = recalcSceneTimes(p.scenes.filter((_, i) => i !== index));
        return { ...p, scenes, timeline: buildTimelineFromScenes(scenes, p.musicMood) };
      }),

    rebuildTimeline: () =>
      commit((p) => ({ ...p, timeline: buildTimelineFromScenes(p.scenes, p.musicMood) })),

    addClip: (trackId, partial) => {
      const { project } = get();
      if (!project) return null;
      const track = project.timeline.find((t) => t.id === trackId);
      if (!track) return null;
      const clip: Clip = {
        id: uid("clip"), trackId, type: track.type, label: partial.label ?? track.name,
        start: partial.start ?? 0, duration: partial.duration ?? 3, offset: 0,
        color: partial.color ?? "#fb923c", payload: partial.payload, sceneId: partial.sceneId,
      };
      pushHistory();
      set({
        project: {
          ...project,
          timeline: project.timeline.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) } : t
          ),
        },
        dirty: true,
        selectedClipId: clip.id,
      });
      return clip;
    },

    updateClip: (id, patch, history = true) => {
      const apply = (tl: Track[]): Track[] =>
        tl.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      const { project } = get();
      if (!project) return;
      if (history) pushHistory();
      set({ project: { ...project, timeline: apply(project.timeline) }, dirty: true });
    },

    removeClip: (id) => {
      const { project } = get();
      if (!project) return;
      pushHistory();
      set({
        project: {
          ...project,
          timeline: project.timeline.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })),
        },
        dirty: true,
        selectedClipId: get().selectedClipId === id ? null : get().selectedClipId,
      });
    },

    duplicateClip: (id) => {
      const { project } = get();
      if (!project) return;
      pushHistory();
      let newId: string | null = null;
      const timeline = project.timeline.map((t) => {
        const found = t.clips.find((c) => c.id === id);
        if (!found) return t;
        const copy: Clip = { ...structuredClone(found), id: uid("clip"), start: found.start + found.duration };
        newId = copy.id;
        return { ...t, clips: [...t.clips, copy].sort((a, b) => a.start - b.start) };
      });
      set({ project: { ...project, timeline }, dirty: true, selectedClipId: newId });
    },

    splitClipAt: (id, time) => {
      const { project } = get();
      if (!project) return;
      pushHistory();
      const timeline = project.timeline.map((t) => {
        const clip = t.clips.find((c) => c.id === id);
        if (!clip || time <= clip.start + 0.1 || time >= clip.start + clip.duration - 0.1) return t;
        const firstDur = time - clip.start;
        const second: Clip = {
          ...structuredClone(clip),
          id: uid("clip"),
          start: time,
          duration: clip.duration - firstDur,
          offset: clip.offset + firstDur,
        };
        const first = { ...clip, duration: firstDur };
        return { ...t, clips: [...t.clips.filter((c) => c.id !== id), first, second].sort((a, b) => a.start - b.start) };
      });
      set({ project: { ...project, timeline }, dirty: true });
    },

    setTrackMuted: (trackId, muted) => {
      const { project } = get();
      if (!project) return;
      pushHistory();
      set({
        project: {
          ...project,
          timeline: project.timeline.map((t) => (t.id === trackId ? { ...t, muted } : t)),
        },
        dirty: true,
      });
    },

    undo: () => {
      const { project, past, future } = get();
      if (!project || !past.length) return;
      const prev = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [...future, snap(project)].slice(-60),
        project: { ...project, ...structuredClone(prev) },
        dirty: true,
      });
    },

    redo: () => {
      const { project, past, future } = get();
      if (!project || !future.length) return;
      const next = future[future.length - 1];
      set({
        future: future.slice(0, -1),
        past: [...past, snap(project)].slice(-60),
        project: { ...project, ...structuredClone(next) },
        dirty: true,
      });
    },

    projectDuration: () => {
      const p = get().project;
      if (!p) return 0;
      const sceneEnd = p.scenes.length ? p.scenes[p.scenes.length - 1].start + p.scenes[p.scenes.length - 1].duration : 0;
      const clipEnd = p.timeline.flatMap((t) => t.clips).reduce((a, c) => Math.max(a, c.start + c.duration), 0);
      return Math.max(sceneEnd, clipEnd);
    },
  };
});
