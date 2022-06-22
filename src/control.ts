const IS_DEMAND_STATION_SIGNAL: SignalID = {
  type: "virtual",
  name: "signal-D",
};
const IS_SUPPLY_STATION_SIGNAL: SignalID = {
  type: "virtual",
  name: "signal-S",
};
const IS_DEPOT_STATION_SIGNAL: SignalID = { type: "virtual", name: "signal-0" };

const signalsMatch = (a: SignalID, b: SignalID) => {
  if (!a) {
    if (!b) {
      return true;
    } else {
      return false;
    }
  } else if (!b) {
    return false;
  } else {
    return a.type == b.type && a.name == b.name;
  }
};

const getWagonCapacity = (signal: SignalID) => {
  if (signal.type == "item") {
    const prototype = game.item_prototypes[signal.name!];
    if (prototype.stackable) {
      return 40 * prototype.stack_size;
    } else {
      return 40;
    }
  } else if (signal.type == "fluid") {
    return 25000;
  } else {
    return 0;
  }
};

const getTrainDestination = (train: LuaTrain, index: number) =>
  train.schedule && train.schedule.records[index - 1]?.station;

const getTrainsWithDestination = (station: TrainStopEntity, index: number) =>
  getAllTrains().filter(
    (train) =>
      getTrainDestination(train, index) == station.backer_name &&
      train.schedule!.current <= index
  );

const getStationRedSignalCount = (
  station: TrainStopEntity,
  signal: SignalID
) => {
  const network = station.get_circuit_network(defines.wire_type.red);
  return network?.signals?.find((networkSignal) =>
    signalsMatch(signal, networkSignal.signal)
  )?.count;
};

const stationHasRedSignal = (station: TrainStopEntity, signal: SignalID) => {
  return getStationRedSignalCount(station, signal) ?? 0 > 0;
};

const isDemandStation = (station: TrainStopEntity) =>
  stationHasRedSignal(station, IS_DEMAND_STATION_SIGNAL);

const isSupplyStation = (station: TrainStopEntity) =>
  stationHasRedSignal(station, IS_SUPPLY_STATION_SIGNAL);

const isDepotStation = (station: TrainStopEntity) =>
  stationHasRedSignal(station, IS_DEPOT_STATION_SIGNAL);

const getDemandCapacity = (station: TrainStopEntity) => {
  return station
    .get_circuit_network(defines.wire_type.red)
    ?.signals?.filter((signal) => signal.signal.type !== "virtual")[0];
};

const getTrainContents = (train: LuaTrain, signal: SignalID) =>
  (signal.type == "item"
    ? train.get_item_count(signal.name)
    : train.get_fluid_count(signal.name)) ?? 0;

const getTrainsContents = (trains: LuaTrain[], signal: SignalID) => {
  return trains.reduce(
    (total, train) => total + getTrainContents(train, signal),
    0
  );
};

const getTrainContentSignal = (train: LuaTrain): SignalID | undefined => {
  const item = Object.keys(train.get_contents())[0];
  if (item) return { type: "item", name: item };
  const fluid = Object.keys(train.get_fluid_contents())[0];
  if (fluid) return { type: "fluid", name: fluid };
};

const getStationStock = (station: TrainStopEntity) => {
  return station.get_circuit_network(defines.wire_type.green)?.signals?.[0];
};

const getDemandBalance = (station: TrainStopEntity) => {
  const demand = getDemandCapacity(station);
  if (!demand) return;
  const deliveringTrains = getTrainsWithDestination(station, 2);
  return {
    signal: demand.signal,
    count: demand.count - getTrainsContents(deliveringTrains, demand.signal),
    trains: deliveringTrains.length,
  };
};

const getSupplyBalance = (station: TrainStopEntity) => {
  const supply = getStationStock(station);
  if (!supply) return;
  const supplyingTrains = getTrainsWithDestination(station, 1);
  return {
    count:
      supply.count +
      getTrainsContents(supplyingTrains, supply.signal) -
      supplyingTrains.length * getWagonCapacity(supply.signal),
    signal: supply.signal,
    trains: supplyingTrains.length,
  };
};

const getAllTrains = () => game?.get_surface("nauvis")?.get_trains() ?? [];
const getAllStations = () => game.get_train_stops();

const getDepotStations = () => getAllStations().filter(isDepotStation);
const getDepotStation = () => getDepotStations()[0];

const isIdleTrain = (train: LuaTrain) =>
  train.station && isDepotStation(train.station);

const getStationMaxTrains = (station: TrainStopEntity) => {
  return (
    getStationRedSignalCount(station, {
      type: "virtual",
      name: "signal-T",
    }) ?? 1
  );
};

const getDemand = (station: TrainStopEntity) => {
  if (!isDemandStation(station)) return;
  const balance = getDemandBalance(station);
  if (!balance) return;
  if (
    balance.count < getWagonCapacity(balance.signal) ||
    balance.trains >= getStationMaxTrains(station)
  )
    return;
  return balance.signal;
};

const canPickup = (station: TrainStopEntity, signal: SignalID) => {
  if (!isSupplyStation(station)) return false;
  const balance = getSupplyBalance(station);
  return (
    !!balance &&
    signalsMatch(balance.signal, signal) &&
    balance.count >= getWagonCapacity(balance.signal) &&
    balance.trains < getStationMaxTrains(station)
  );
};

const matchDemandAndSupply = () => {
  const idleTrain = getAllTrains().find(isIdleTrain);
  if (!idleTrain) {
    return;
  }
  const stations = getAllStations();
  for (const demandStation of stations) {
    const demand = getDemand(demandStation);
    if (!demand) continue;
    const supplyStation = stations.find((station) =>
      canPickup(station, demand)
    );
    if (!supplyStation) {
      return;
    }
    idleTrain.schedule = {
      current: 1,
      records: [
        {
          station: supplyStation.backer_name,
          wait_conditions: [{ type: "full", compare_type: "and" }],
        },
        {
          station: demandStation.backer_name,
          wait_conditions: [{ type: "empty", compare_type: "and" }],
        },
        {
          station: idleTrain.station!.backer_name,
          wait_conditions: [{ type: "full", compare_type: "and" }],
        },
      ],
    };
    return;
  }
};

const init = () => {
  log("welcome to Autotrain");
  script.on_event(defines.events.on_tick, (e) => {
    matchDemandAndSupply();
  });
};

script.on_init(() => {
  init();
});
script.on_load(() => {
  init();
});
