import type { LiveMachine, MachinePlan, MachineOutput } from "./snapshot-types";
import { qualifyItemId } from "./identity";

export function summarizeLiveMachines(
  items: LiveMachine[],
  savedMachines: MachinePlan[] = [],
): MachinePlan[] {
  const grouped = new Map<string, MachinePlan>();
  const addOutput = (list: MachineOutput[] | undefined, name: string, rawId?: string | null, rawVariant?: string | null) => {
    const outputs = list || [];
    const id = rawId ? qualifyItemId(rawId) : undefined;
    const variant = rawVariant ? qualifyItemId(rawVariant) : undefined;
    const existing = outputs.find((item) => id ? item.id === id && item.variant === variant : !item.id && item.name === name);
    if (existing) existing.count += 1;
    else outputs.push({ ...(id ? { id } : {}), ...(variant ? { variant } : {}), name, count: 1 });
    return outputs;
  };
  for (const item of items) {
    const id = item.id ? qualifyItemId(item.id, "craftable") : undefined;
    // Older payloads without an ID remain separate from identified machines.
    const key = id ? `id:${id}` : `legacy:${item.name}`;
    const saved = id ? savedMachines.find((machine) => machine.id && qualifyItemId(machine.id, "craftable") === id) : undefined;
    const machine = grouped.get(key) || {
      id,
      displayName: saved?.displayName,
      name: item.name,
      count: 0,
      ready: 0,
      working: 0,
      idle: 0,
      readyOutputs: [],
      workingOutputs: [],
      inputs: [],
      locations: [],
      nextReadyMinutes: null,
    };
    machine.count += 1;
    machine.ready += item.ready ? 1 : 0;
    machine.working += item.processing && !item.ready ? 1 : 0;
    machine.idle =
      (machine.idle || 0) + (!item.ready && !item.processing ? 1 : 0);
    if (!machine.locations!.includes(item.location))
      machine.locations!.push(item.location);
    if (item.output && item.ready)
      machine.readyOutputs = addOutput(machine.readyOutputs, item.output, item.outputId, item.outputVariant);
    else if (item.output && item.processing)
      machine.workingOutputs = addOutput(machine.workingOutputs, item.output, item.outputId, item.outputVariant);
    if (item.input && item.processing)
      machine.inputs = addOutput(machine.inputs, item.input, item.inputId, item.inputVariant);
    if (item.processing && (item.minutesUntilReady || 0) > 0)
      machine.nextReadyMinutes =
        machine.nextReadyMinutes === null
          ? item.minutesUntilReady!
          : Math.min(machine.nextReadyMinutes!, item.minutesUntilReady!);
    grouped.set(key, machine);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      b.ready - a.ready ||
      (b.idle || 0) - (a.idle || 0) ||
      a.name.localeCompare(b.name),
  );
}
