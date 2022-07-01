# Factorio Autotrains Mod

This mod automatically schedules train transports between supply and demand stations, and sends trains to the depot after every transport.

There are 3 types of Stations:

## Supply stations

Supply stations are making goods available to demand stations.
To make a station a supply station:

- send it the "S"-Signal through **red** wire
- send it the available amount of the resource through **green** wire (only one resource can be supplied per station!)
- optionally send it a "T"-Signal through **red** wire, indicating the max train count on this station.

## Demand stations

Demand stations receive deliveries of goods picked up at supply sations.
To make a station a demand station:

- send it the "D"-Signal through **red** wire
- send it the total storage capacity of the resource of demand through **red** wire
- send it the currently stored amount through **green** wire
- optionally send it a "C"-Signal through **red** wire, indicating the amount of stacks that should be transported per train. Defaults to full trains (40 stacks). Not supported for fluid trains.
- optionally send it a "T"-Signal through **red** wire, indicating the max train count on this station.

## Depot stations

Trains stay at depot stations until they get a transport job. After a transport job, they always return to the depot at which they started.
To make a train available for transports, send it to any depot station. As soon as it arrives, it will be assigned transport jobs, if there are any.

Since only trains that are waiting directly at a depot station can be assigned transport jobs, it is recommended to have at least two depot stations: One for item trains, and one for fluid trains. You should not mix these two.

To make a station a depot station:

- send it the "0"-Signal through **red** wire

## Transports

Transports will only be scheduled if the supply station can provide a full wagon of the resource and the demand station can store it completely. Otherwise the supply station have to top up its stocks, or the demand station to use lower it's stocks.

## Trains

Trains always have to consist of just one locomotive, and one cargo or fluid wagon.

## Fueling

Trains can be fueled at depot stations.

# For Developers

## Set up environment

1. Install `Node.js` and `zip`, or fi you have `nix` and `direnv` you'll get this as soon as you enter the directory.
1. Install the dependencies using `npm ci`

## Building the zip

`npm run build`

## Developing in watch-mode

`npm run dev`

You'll have to leave and re-enter the game after each change.

# License

MIT
