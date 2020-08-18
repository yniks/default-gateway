"use strict";

const { isIP } = require("net");
const { networkInterfaces } = require("os");
const execa = require("execa");
const { stdout } = require("process");

const args = {
  v4: ["-4", "r"],
  v6: ["-6", "r"],
};
const getMultiple = (stdout, family) => {
  let result = [];

  (stdout || "").trim().split("\n").forEach(line => {
    const results = /default( via .+?)?( dev .+?)( |$)/.exec(line) || [];
    const gateway = (results[1] || "").substring(5);
    const iface = (results[2] || "").substring(5);
    if (gateway && isIP(gateway)) { // default via 1.2.3.4 dev en0
      result.push({ gateway, interface: (iface ? iface : null), family });
    } else if (iface && !gateway) { // default via dev en0
      const interfaces = networkInterfaces();
      const addresses = interfaces[iface];
      if (!addresses || !addresses.length) return;

      addresses.forEach(addr => {
        if (addr.family.substring(2) === family && isIP(addr.address)) {
          result.push({ gateway: addr.address, interface: (iface ? iface : null), family })
        }
      });
    }
  });

  return result;
}
const parse = (stdout, family) => {
  let result;

  (stdout || "").trim().split("\n").some(line => {
    const results = /default( via .+?)?( dev .+?)( |$)/.exec(line) || [];
    const gateway = (results[1] || "").substring(5);
    const iface = (results[2] || "").substring(5);
    if (gateway && isIP(gateway)) { // default via 1.2.3.4 dev en0
      result = { gateway, interface: (iface ? iface : null), family };
      return true;
    } else if (iface && !gateway) { // default via dev en0
      const interfaces = networkInterfaces();
      const addresses = interfaces[iface];
      if (!addresses || !addresses.length) return;

      addresses.some(addr => {
        if (addr.family.substring(2) === family && isIP(addr.address)) {
          result = { gateway: addr.address, interface: (iface ? iface : null), family };
          return true;
        }
      });
    }
  });

  if (!result) {
    throw new Error("Unable to determine default gateway");
  }

  return result;
};

const promise = async family => {
  const { stdout } = await execa("ip", args[family]);
  return parse(stdout, family);
};
const all = async _ => {
  const { stdout: stdout4 } = await execa("ip", args['v4']);
  const { stdout: stdout6 } = await execa("ip", args['v6']);
  return getMultiple(stdout4, 'v4').concat(await getMultiple(stdout6, 'v6'))
}
const sync = family => {
  const { stdout } = execa.sync("ip", args[family]);
  return parse(stdout, family);
};

module.exports.v4 = () => promise("v4");
module.exports.v6 = () => promise("v6");
module.exports.all = () => all()

module.exports.v4.sync = () => sync("v4");
module.exports.v6.sync = () => sync("v6");
