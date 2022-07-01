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
  const trains = getTrainsWithDestination(station, 2);
  const pickingUp = trains.filter((train) => train.schedule?.current === 1);
  const delivering = trains.filter((train) => train.schedule?.current === 2);

  return {
    signal: demand.signal,
    count:
      demand.count -
      (getStationStock(station)?.count ?? 0) -
      getTrainsContents(delivering, demand.signal) -
      pickingUp.length * getWagonCapacity(demand.signal),
    trains: pickingUp.length && delivering.length,
  };
};

const times = <T>(object: T, count: number): T[] => {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(object);
  }
  return result;
};

const getStationDemands = (station: TrainStopEntity): Demand[] => {
  const balance = getDemandBalance(station);
  if (!balance) return [];
  const trains = Math.floor(balance.count / getWagonCapacity(balance.signal));
  return times(
    {
      signal: balance.signal,
      station,
    },
    trains
  );
};

const getStationSupplies = (station: TrainStopEntity): Supply[] => {
  const balance = getSupplyBalance(station);
  if (!balance) return [];
  const trains = Math.floor(balance.count / getWagonCapacity(balance.signal));
  return times(
    {
      signal: balance.signal,
      station,
    },
    trains
  );
};

const getSupplyBalance = (station: TrainStopEntity) => {
  const supply = getStationStock(station);
  if (!supply) return;
  const supplyingTrains = getTrainsWithDestination(station, 1).filter(
    (train) => train.schedule?.current === 1
  );
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

const isIdleTrain = (train: LuaTrain) =>
  train.station && isDepotStation(train.station);
const isFluidTrain = (train: LuaTrain) => train.fluid_wagons.length > 0;
const isItemTrain = (train: LuaTrain) => !isFluidTrain(train);
const isFluid = (signal: SignalID) => signal.type == "fluid";

const getStationMaxTrains = (station: TrainStopEntity) => {
  return (
    getStationRedSignalCount(station, {
      type: "virtual",
      name: "signal-T",
    }) ?? 1
  );
};

type Matcher<T> = (a: T, b: T) => boolean;
type Changes<T> = {
  added: T[];
  remained: T[];
  removed: T[];
};

const detectChanges = <T>(
  previous: T[],
  current: T[],
  match: Matcher<T>
): Changes<T> => {
  const removed: T[] = [];
  const added: T[] = [...current];
  const remained: T[] = [];
  for (const a of previous) {
    const index = added.findIndex((b) => match(a, b));
    if (index >= 0) {
      remained.push(a);
      added.splice(index, 1);
    } else {
      removed.push(a);
    }
  }
  return {
    removed,
    remained,
    added,
  };
};

const supplyOrDemandMatches = <
  T extends { station: TrainStopEntity; signal: SignalID }
>(
  a: T,
  b: T
) =>
  a.station.unit_number == b.station.unit_number &&
  signalsMatch(a.signal, b.signal);

type Supply = {
  station: TrainStopEntity;
  signal: SignalID;
};

type Demand = {
  station: TrainStopEntity;
  signal: SignalID;
};

type State = {
  supplies: Supply[];
  demands: Demand[];
};

const getState = (): State => {
  const state: State = { demands: [], supplies: [] };
  const stations = getAllStations();
  for (const station of stations) {
    if (isDemandStation(station)) {
      state.demands.push(...getStationDemands(station));
    } else if (isSupplyStation(station)) {
      state.supplies.push(...getStationSupplies(station));
    }
  }
  return state;
};

let previousState: State = { demands: [], supplies: [] };

const logChanges = (
  name: string,
  changes: {
    added: { station: TrainStopEntity; signal: SignalID }[];
    removed: { station: TrainStopEntity; signal: SignalID }[];
  }
) => {
  logChangesOfType(name, "Added", changes.added);
  logChangesOfType(name, "Removed", changes.removed);
};

const logChangesOfType = (
  name: string,
  type: string,
  changes: { station: TrainStopEntity; signal: SignalID }[]
) => {
  for (const { station, signal } of changes) {
    log(`${type} ${name} of ${signal.name} at station ${station.valid ? station.backer_name : "unknown"}`);
  }
};

const scheduleTransports = () => {
  const currentState = getState();
  const demandChanges = detectChanges(
    previousState.demands,
    currentState.demands,
    supplyOrDemandMatches
  );
  logChanges("demand", demandChanges);

  const supplyChanges = detectChanges(
    previousState.supplies,
    currentState.supplies,
    supplyOrDemandMatches
  );
  logChanges("supply", supplyChanges);

  const state = {
    supplies: currentState.supplies,
    demands: [...demandChanges.remained, ...demandChanges.added],
  };
  const idleTrains = getAllTrains().filter(isIdleTrain);
  const fluidTrains = idleTrains.filter(isFluidTrain);
  const itemTrains = idleTrains.filter(isItemTrain);

  for (let i = 0; i < state.demands.length; i++) {
    const demand = state.demands[i];
    const supply = findAndRemoveSupply(state.supplies, demand.signal);
    if (!supply) continue;

    const trains = isFluid(demand.signal) ? fluidTrains : itemTrains;
    if (trains.length === 0) continue;

    scheduleTransport(
      supply.signal,
      supply.station,
      demand.station,
      trains.shift()!
    );
    state.demands.splice(i, 1);
    i -= 1;
  }
  previousState = state;
};

const findAndRemoveSupply = (supplies: Supply[], signal: SignalID) => {
  const index = supplies.findIndex((supply) =>
    signalsMatch(supply.signal, signal)
  );
  if (index >= 0) {
    return supplies.splice(index, 1)[0];
  } else {
    return null;
  }
};

const scheduleTransport = (
  signal: SignalID,
  supplyStation: TrainStopEntity,
  demandStation: TrainStopEntity,
  train: LuaTrain
) => {
  log(
    `transporting ${signal.name} from ${supplyStation.backer_name} to ${demandStation.backer_name} on train ${train.id}`
  );
  train.schedule = {
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
        station: train.station!.backer_name,
        wait_conditions: [{ type: "full", compare_type: "and" }],
      },
    ],
  };
};

const init = () => {
  log("welcome to Autotrains");
  script.on_event(defines.events.on_tick, (e) => {
    if (e.tick % 60 != 0) return;
    scheduleTransports();
  });
};

script.on_init(() => {
  init();
});
script.on_load(() => {
  init();
});
