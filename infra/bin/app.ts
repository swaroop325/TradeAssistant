#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TradeAssistantStack } from "../lib/stack";

const app = new cdk.App();

new TradeAssistantStack(app, "TradeAssistant", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-southeast-1",
  },
  description: "TradeAssistant - Personal Gold Trading Intelligence Platform",
});
