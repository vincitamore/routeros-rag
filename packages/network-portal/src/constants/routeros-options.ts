export const ROUTEROS_PROTOCOLS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'icmpv6', label: 'ICMPv6' },
  { value: 'ospf', label: 'OSPF' },
  { value: 'gre', label: 'GRE' },
  { value: 'ipsec-esp', label: 'IPSec ESP' },
  { value: 'ipsec-ah', label: 'IPSec AH' },
  { value: 'ipip', label: 'IP-in-IP' },
  { value: 'ipv6', label: 'IPv6' },
  { value: 'rsvp', label: 'RSVP' },
  { value: 'pim', label: 'PIM' },
  { value: 'vrrp', label: 'VRRP' },
  { value: '1', label: 'ICMP (1)' },
  { value: '2', label: 'IGMP (2)' },
  { value: '4', label: 'IP-in-IP (4)' },
  { value: '6', label: 'TCP (6)' },
  { value: '17', label: 'UDP (17)' },
  { value: '41', label: 'IPv6 (41)' },
  { value: '46', label: 'RSVP (46)' },
  { value: '47', label: 'GRE (47)' },
  { value: '50', label: 'ESP (50)' },
  { value: '51', label: 'AH (51)' },
  { value: '89', label: 'OSPF (89)' },
  { value: '103', label: 'PIM (103)' },
  { value: '112', label: 'VRRP (112)' }
];

export const FIREWALL_CHAINS = [
  { value: 'input', label: 'Input' },
  { value: 'forward', label: 'Forward' },
  { value: 'output', label: 'Output' }
];

export const FIREWALL_ACTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'drop', label: 'Drop' },
  { value: 'reject', label: 'Reject' },
  { value: 'log', label: 'Log' },
  { value: 'passthrough', label: 'Passthrough' },
  { value: 'return', label: 'Return' },
  { value: 'jump', label: 'Jump' },
  { value: 'tarpit', label: 'Tarpit' },
  { value: 'fasttrack-connection', label: 'FastTrack Connection' }
];

export const GATEWAY_TYPES = [
  { value: 'ip', label: 'Direct gateway (IP address)' },
  { value: 'interface', label: 'Interface gateway' }
];

export const CONNECTION_STATES = [
  { value: 'new', label: 'New' },
  { value: 'established', label: 'Established' },
  { value: 'related', label: 'Related' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'untracked', label: 'Untracked' }
];

export const TCP_FLAGS = [
  { value: 'syn', label: 'SYN' },
  { value: 'ack', label: 'ACK' },
  { value: 'fin', label: 'FIN' },
  { value: 'rst', label: 'RST' },
  { value: 'psh', label: 'PSH' },
  { value: 'urg', label: 'URG' },
  { value: 'ece', label: 'ECE' },
  { value: 'cwr', label: 'CWR' }
];

export const ICMP_TYPES = [
  { value: '0', label: 'Echo Reply (0)' },
  { value: '3', label: 'Destination Unreachable (3)' },
  { value: '8', label: 'Echo Request (8)' },
  { value: '11', label: 'Time Exceeded (11)' },
  { value: '12', label: 'Parameter Problem (12)' }
]; 