import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def test_mongodb():
    # Use a local MongoDB instance for testing
    MONGODB_URL = "mongodb://localhost:27017/"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.test_db
    
    try:
        # Test connection
        await client.server_info()
        print("MongoDB connection successful!")
        
        # Test database operations
        test_collection = db.test_collection
        test_data = {"name": "test", "value": 123}
        
        # Insert test data
        result = await test_collection.insert_one(test_data)
        print(f"Inserted document with id: {result.inserted_id}")
        
        # Retrieve test data
        doc = await test_collection.find_one({"name": "test"})
        print(f"Retrieved document: {doc}")
        
    except Exception as e:
        print(f"MongoDB connection error: {e}")
    finally:
        client.close()

# Run the test
asyncio.run(test_mongodb())
