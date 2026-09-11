"use client";

import { useI18n } from "../i18n";
import { routeLocationName } from "./formatting";
import { resolveGameDisplayName } from "./game-names";
import type { FarmAnimal, Interior, Snapshot } from "./snapshot-types";

export function InteriorAnimalRoster({ animals, interior, data, isLive }: {
  animals: FarmAnimal[]; interior: Interior; data: Snapshot; isLive: boolean;
}) {
  const { t } = useI18n();
  return <section className="interior-animal-roster" aria-label={t("map.animals.residents")}>
    <h3>{t("map.animals.residents")} <span>({animals.length})</span></h3>
    <p>{t(isLive ? "map.animals.live" : "map.animals.saved")}</p>
    {animals.length === 0 && <p>{t("map.animals.empty")}</p>}
    {animals.map(animal => {
      const inside = animal.locationId === interior.id || (!animal.locationId && animal.location === interior.name);
      const typeKey = `animal.type.${animal.type.toLowerCase().replaceAll(" ", "")}`;
      const translatedType = t(typeKey);
      const produceId = animal.currentProduce;
      const produce = produceId && produceId !== "-1"
        ? resolveGameDisplayName(data.localizedNamesByQualifiedId || {}, data.localizedObjectNamesByEnglish || {}, produceId,
          produceId.startsWith("(") ? produceId : `(O)${produceId}`)
        : t("animal.noProduce");
      return <article key={animal.id}>
        <h4>{animal.name}</h4>
        <p>{translatedType === typeKey ? animal.type : translatedType}</p>
        <p>{inside ? t("map.animals.inside") : t("map.animals.away", { location: routeLocationName(animal.location, t) })}</p>
        <dl>
          <div><dt>{t("web.planning.friendship")}</dt><dd>{animal.friendship}/1000</dd></div>
          <div><dt>{t("web.planning.happiness")}</dt><dd>{animal.happiness}/255</dd></div>
          <div><dt>{t("map.animals.fullness")}</dt><dd>{animal.fullness}/255</dd></div>
          <div><dt>{t("today.when.today")}</dt><dd>{t(animal.petted ? "animal.petted" : "animal.needsPetting")}</dd></div>
          <div><dt>{t("animal.produce")}</dt><dd>{produce}</dd></div>
        </dl>
      </article>;
    })}
  </section>;
}
