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

const getTrainDestination = (train: LuaTrain) =>
  train.schedule && train.schedule.records[0]?.station;

const getTrainsWithDestination = (station: TrainStopEntity) =>
  getAllTrains().filter(
    (train) => getTrainDestination(train) == station.backer_name
  );

const stationHasRedSignal = (station: TrainStopEntity, signal: SignalID) => {
  const network = station.get_circuit_network(defines.wire_type.red);
  return !!network?.signals?.find((networkSignal) =>
    signalsMatch(signal, networkSignal.signal)
  );
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
    ?.signals?.filter(
      (signal) =>
        !signalsMatch(signal.signal, { type: "virtual", name: "signal-D" })
    )[0];
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
  const deliveringTrains = getTrainsWithDestination(station);
  return {
    signal: demand.signal,
    count: demand.count - getTrainsContents(deliveringTrains, demand.signal),
  };
};

const getSupplyBalance = (station: TrainStopEntity) => {
  const supply = getStationStock(station);
  const supplyingTrains = getTrainsWithDestination(station);
  if (!supply) return;
  return {
    count: supply.count - getTrainsContents(supplyingTrains, supply.signal),
    signal: supply.signal,
  };
};

const scheduleTrain = (
  train: LuaTrain,
  station: TrainStopEntity,
  action: "PICKUP" | "DELIVER" | "WAIT"
) => {
  train.schedule = {
    current: 1,
    records: [
      {
        station: station.backer_name,
        wait_conditions:
          action == "WAIT"
            ? []
            : [
                {
                  type: action == "PICKUP" ? "full" : "empty",
                  compare_type: "and",
                },
              ],
      },
    ],
  };
};

const scheduleDelivery = (train: LuaTrain, station: TrainStopEntity) => {
  const depot = getDepotStation();
  if (!depot) return;
  train.schedule = {
    current: 1,
    records: [
      {
        station: station.backer_name,
        wait_conditions: [{ type: "empty", compare_type: "and" }],
      },
      {
        station: depot.backer_name,
        wait_conditions: [{ compare_type: "and", type: "full" }],
      },
    ],
  };
};

const schedulePickup = (train: LuaTrain, station: TrainStopEntity) => {
  train.schedule = {
    current: 1,
    records: [
      {
        station: station.backer_name,
        wait_conditions: [{ type: "full", compare_type: "and" }],
      },
    ],
  };
};

const getAllTrains = () => game?.get_surface("nauvis")?.get_trains() ?? [];
const getAllStations = () => game.get_train_stops();

const getIdleTrains = () => getAllTrains().filter(isIdleTrain);
const getDepotStations = () => getAllStations().filter(isDepotStation);
const getDepotStation = () => getDepotStations()[0];

const isIdleTrain = (train: LuaTrain) =>
  train.station && isDepotStation(train.station);

const isFullTrain = (train: LuaTrain) => {
  if (!train.station || !isSupplyStation(train.station)) return false;
  const contentSignal = getTrainContentSignal(train);
  if (!contentSignal) return false;
  const content = getTrainContents(train, contentSignal);
  return content >= getWagonCapacity(contentSignal);
};

const sendPickupTrain = () => {
  const idleTrain = getAllTrains().find(isIdleTrain);
  if (!idleTrain) {
    log("no idle trains");
    return;
  }

  const pickupStation = getAllStations().find((station) => {
    if (!isSupplyStation) return false;
    const balance = getSupplyBalance(station);
    return balance && balance.count >= getWagonCapacity(balance.signal);
  });
  if (!pickupStation) {
    log("no pickup stations");
    return;
  }
  schedulePickup(idleTrain, pickupStation);
};

const sendDeliveryTrain = () => {
  const fullTrain = getAllTrains().find(isFullTrain);
  if (!fullTrain) {
    log("no full trains");
    return;
  }
  const signal = getTrainContentSignal(fullTrain)!;
  const deliveryStation = getAllStations().find((station) => {
    if (!isDemandStation(station)) return false;
    const balance = getDemandBalance(station);
    if (!balance || !signalsMatch(balance.signal, signal)) return false;
    return balance.count >= getWagonCapacity(signal);
  });
  if (!deliveryStation) {
    log("no delivery stations");
    return;
  }
  scheduleDelivery(fullTrain, deliveryStation);
};

const printTrainStates = () => {
  for (const train of getAllTrains()) {
    log(train.id + " - " + train.state);
  }
};

const printDemandBalances = () => {
  log("Demands:");
  for (const station of getAllStations().filter(isDemandStation)) {
    const demand = getDemandBalance(station);
    if (!demand) return;
    log(station.backer_name + ": " + demand.count + " " + demand.signal.name);
  }
};

const printSupplyBalances = () => {
  log("Supplies:");
  for (const station of getAllStations().filter(isSupplyStation)) {
    const supply = getSupplyBalance(station);
    if (!supply) return;
    log(station.backer_name + ": " + supply.count + " " + supply.signal.name);
  }
};

const init = () => {
  log("welcome to Autotrain");
  script.on_event(defines.events.on_tick, (e) => {
    if (e.tick % 60 > 0) return;
    log("tick");
    sendPickupTrain();
    sendDeliveryTrain();
    printTrainStates();
    printSupplyBalances();
    printDemandBalances();
  });
};

script.on_init(() => {
  init();
});
script.on_load(() => {
  init();
});
