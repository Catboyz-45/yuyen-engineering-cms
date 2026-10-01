-- Icon shown on public service cards. NULL lets the site pick one from the service name.

-- CreateEnum
CREATE TYPE "ServiceIcon" AS ENUM ('AIR_VENT', 'SNOWFLAKE', 'DROPLETS', 'WRENCH', 'CLIPBOARD_CHECK', 'BUILDING', 'ZAP', 'FAN', 'THERMOMETER', 'HARD_HAT');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "icon" "ServiceIcon";
