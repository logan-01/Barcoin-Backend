import { point, polygon } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { database, goatsRef } from "../lib/firebase/config";

// Fence Zone
const fenceZone = [
  { latitude: 12.6628995001426, longitude: 121.4827613069387 },
  { latitude: 12.66240069056005, longitude: 121.4826198025208 },
  { latitude: 12.66176242567455, longitude: 121.4841187065387 },
  { latitude: 12.66201429838175, longitude: 121.4846489167927 },
  { latitude: 12.66333283916572, longitude: 121.4847621471397 },
  { latitude: 12.66352930372147, longitude: 121.482774201705 },
  { latitude: 12.6628995001426, longitude: 121.4827613069387 }, // Close loop
];

// House Zone
const houseZone = [
  { latitude: 12.66201711598284, longitude: 121.4836996862916 },
  { latitude: 12.66222227442304, longitude: 121.4837823666245 },
  { latitude: 12.66230475732332, longitude: 121.4835314463667 },
  { latitude: 12.66210327171895, longitude: 121.4834597219564 },
  { latitude: 12.66201711598284, longitude: 121.4836996862916 }, // Close loop
];

const fencePolygon = polygon([fenceZone.map((c) => [c.longitude, c.latitude])]);
const housePolygon = polygon([houseZone.map((c) => [c.longitude, c.latitude])]);

const getUnixTimestamp = () => Math.floor(Date.now() / 1000);

export const isInsideZoneListener = () => {
  goatsRef.on("child_changed", async (snapshot) => {
    const goatId = snapshot.key as string;
    const goat = snapshot.val();

    if (
      typeof goat.latitude === "number" &&
      typeof goat.longitude === "number"
    ) {
      const goatPoint = point([goat.longitude, goat.latitude]);

      const isInsideFence = booleanPointInPolygon(goatPoint, fencePolygon);
      const isInsideHouse = booleanPointInPolygon(goatPoint, housePolygon);

      const goatRef = goatsRef.child(goatId);
      const prevSnap = await goatRef.once("value");
      const prevData = prevSnap.val();

      const updates: any = {
        isInsideFence,
        isInsideHouse,
      };

      const timestampsRef = database.ref(`Timestamps/Goats/${goatId}`);
      const timestampUpdates: any = {};
      const now = getUnixTimestamp();

      // Detect transition for Fence
      const prevFenceStatus = prevData?.isInsideFence;
      if (
        typeof prevFenceStatus === "boolean" &&
        prevFenceStatus !== isInsideFence
      ) {
        const newFenceStatus = isInsideFence ? "Inside" : "Outside";
        timestampUpdates[`Fence/${newFenceStatus}/${now}`] = now;
      }

      // Detect transition for House
      const prevHouseStatus = prevData?.isInsideHouse;
      if (
        typeof prevHouseStatus === "boolean" &&
        prevHouseStatus !== isInsideHouse
      ) {
        const newHouseStatus = isInsideHouse ? "Inside" : "Outside";
        timestampUpdates[`House/${newHouseStatus}/${now}`] = now;
      }

      // Apply updates
      await goatRef.update(updates);
      if (Object.keys(timestampUpdates).length > 0) {
        await timestampsRef.update(timestampUpdates);
      }

      console.log(
        `Goat ${goatId} status updated: Fence=${isInsideFence}, House=${isInsideHouse}, Timestamp=${now}`
      );
    } else {
      console.warn(`Invalid coordinates for goat ${goatId}`);
    }
  });
};
