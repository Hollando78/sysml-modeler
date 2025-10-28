import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../../config/index.js';

let driver: Driver | null = null;

export function initDriver(): Driver {
  if (driver) {
    return driver;
  }

  driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 60000,
    }
  );

  return driver;
}

export function getDriver(): Driver {
  if (!driver) {
    throw new Error('Neo4j driver not initialized. Call initDriver() first.');
  }
  return driver;
}

export function getSession(): Session {
  const driver = getDriver();
  return driver.session({
    database: config.neo4j.database,
  });
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function verifyConnection(): Promise<void> {
  const driver = getDriver();
  await driver.verifyConnectivity();
  console.log('✓ Neo4j connection verified');
}
