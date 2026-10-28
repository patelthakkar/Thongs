'use strict';

// Three-way merge for whole-library saves coming from multiple windows.
//
// base is the last library this window loaded or saved, current is what is on
// disk, and incoming is the window's new save. Unchanged fields follow the
// other side; concurrent changes to the same field resolve to the incoming
// save. Collections merge by item id so an edit in one window does not discard
// an unrelated item added in another.
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeValue(base, current, incoming) {
  if (equal(incoming, base)) return current;
  if (equal(current, base)) return incoming;
  if (equal(incoming, current)) return incoming;
  if (isObject(base) && isObject(current) && isObject(incoming)) {
    const result = { ...current };
    for (const key of new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)])) {
      result[key] = mergeValue(base[key], current[key], incoming[key]);
    }
    return result;
  }
  return incoming;
}

function mergeEntity(base, current, incoming) {
  if (current === undefined && incoming === undefined) return undefined;
  if (!base) {
    return current === undefined ? incoming : incoming === undefined ? current : mergeValue({}, current, incoming);
  }
  if (current === undefined) return equal(incoming, base) ? undefined : incoming;
  if (incoming === undefined) return equal(current, base) ? undefined : current;
  return mergeValue(base, current, incoming);
}

function mergeCollection(base = [], current = [], incoming = []) {
  const baseMap = new Map(base.map(item => [item.id, item]));
  const currentMap = new Map(current.map(item => [item.id, item]));
  const incomingMap = new Map(incoming.map(item => [item.id, item]));
  const order = [
    ...current.map(item => item.id),
    ...incoming.map(item => item.id).filter(id => !currentMap.has(id))
  ];
  const result = [];
  for (const id of new Set(order)) {
    const merged = mergeEntity(baseMap.get(id), currentMap.get(id), incomingMap.get(id));
    if (merged !== undefined) result.push(merged);
  }
  return result;
}

function mergeTags(base = [], current = [], incoming = []) {
  if (equal(incoming, base)) return current;
  if (equal(current, base)) return incoming;
  if (equal(incoming, current)) return current;
  return [...new Set([...current, ...incoming])];
}

function mergeLibraries(base, current, incoming) {
  const mergedTasks = mergeCollection(base?.tasks, current?.tasks, incoming?.tasks).map(task => {
    const baseTask = base?.tasks?.find(item => item.id === task.id);
    const currentTask = current?.tasks?.find(item => item.id === task.id);
    const incomingTask = incoming?.tasks?.find(item => item.id === task.id);
    return { ...task, tags: mergeTags(baseTask?.tags, currentTask?.tags, incomingTask?.tags) };
  });
  return {
    ...current,
    ...incoming,
    version: 1,
    tasks: mergedTasks,
    projects: mergeCollection(base?.projects, current?.projects, incoming?.projects),
    areas: mergeCollection(base?.areas, current?.areas, incoming?.areas),
    tags: mergeTags(base?.tags, current?.tags, incoming?.tags),
    settings: mergeValue(base?.settings || {}, current?.settings || {}, incoming?.settings || {}),
    updatedAt: new Date().toISOString()
  };
}

module.exports = { mergeLibraries, mergeValue, mergeCollection };
