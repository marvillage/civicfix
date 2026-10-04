import { handleCommunity } from "./community";
import { handleAdmin } from "./admin";
import { handleCosts } from "./costs";
import { handlePulse } from "./pulse";

// Checked in order by the demo adapter after exact fixtures.
export const MOCK_HANDLERS = [
  handlePulse,
  handleCommunity,
  handleAdmin,
  handleCosts,
];
