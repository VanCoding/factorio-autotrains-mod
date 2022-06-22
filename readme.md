# Autotrains

This mod automatically schedules train transports between supply and demand stations, and sends trains to the depot after every transport.

There are 3 types of Stations:

## Supply stations

Supply stations are making goods available to demand stations.
To make a station a supply station:

- send it the "S"-Signal through **red** wire
- send it the available amount of the resource through **green** wire (only one resource can be supplied per station!)

## Demand stations

Demand stations receive deliveries of goods picked up at supply sations.
To make a station a demand station:

- send it the "D"-Signal through **red** wire
- send it the total storage capacity of the resource of demand through **red** wire
- send it the currently stored amount through **green** wire

## Depot stations

Trains stay at depot stations until they get a transport job. After a transport job, they always return to the depot at which they started.
To make a train available for transports, send it to any depot station. As soon as it arrives, it will be assigned transport jobs, if there are any.

To make a station a depot station:

- send it the "0"-Signal through **red** wire

## Transports

Transports will only be scheduled if the supply station can provide a full wagon of the resource and the demand station can store it completely. Otherwise the supply station have to top up its stocks, or the demand station to use lower it's stocks.

## Trains
Trains always have to consist of just one locomotive, and one cargo or fluid wagon.

## Fueling
Trains can be fueled at depot stations.
