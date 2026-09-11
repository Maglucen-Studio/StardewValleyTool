import type { FarmAnimal, Interior } from "./snapshot-types";

export function interiorAnimals(interior: Interior, interiors: Interior[], animals: FarmAnimal[]) {
  const uniqueName = interiors.filter(item => item.name === interior.name).length === 1;
  const seen = new Set<string>();
  return animals.filter(animal => {
    const matches = animal.homeId ? animal.homeId === interior.id : animal.locationId
      ? animal.locationId === interior.id
      : uniqueName && animal.location === interior.name;
    if (!matches || seen.has(animal.id)) return false;
    seen.add(animal.id);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}
