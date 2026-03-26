# app/api/dependencies.py
from fastapi import Depends
from app.core.dependencies import setup_services

# Global services instance
services = setup_services()

def get_db_repo():
    return services["db_repo"]

def get_notifier():
    return services["notifier"]

def get_routing_provider():
    return services["routing_provider"]

def get_sensor_pipeline():
    return services["sensor_pipeline"]