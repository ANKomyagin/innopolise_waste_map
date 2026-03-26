# app/services/analytics.py
from typing import List, Dict, Any
from app.domain.models import Container


class AnalyticsService:
    """Service for processing analytics and generating insights"""
    
    def __init__(self, db_repo):
        self.db_repo = db_repo
    
    def get_container_statistics(self) -> Dict[str, Any]:
        """Get comprehensive container statistics"""
        containers = self.db_repo.get_all()
        active_containers = [c for c in containers if c.sensor_data]
        
        if not active_containers:
            return {"message": "Нет данных для аналитики"}
        
        return {
            "total_containers": len(containers),
            "active_containers": len(active_containers),
            "average_fill_percent": self._calculate_average_fill(active_containers),
            "containers_needing_collection": self._get_containers_needing_collection(active_containers),
            "hardware_alerts": self._get_hardware_alerts(active_containers)
        }
    
    def get_fill_trends(self, container_id: str, days: int = 7) -> Dict[str, Any]:
        """Get fill level trends for a specific container"""
        # This would require historical data - placeholder for future implementation
        return {
            "container_id": container_id,
            "trend": "stable",
            "average_fill": 45,
            "projection_days_until_full": 8
        }
    
    def get_optimization_suggestions(self) -> List[Dict[str, Any]]:
        """Get suggestions for route optimization and container placement"""
        containers = self.db_repo.get_all()
        active_containers = [c for c in containers if c.sensor_data]
        
        suggestions = []
        
        # Find frequently overflowing containers
        overflow_containers = [c for c in active_containers if c.sensor_data.fill_percent >= 80]
        if overflow_containers:
            suggestions.append({
                "type": "capacity_increase",
                "containers": [c.id for c in overflow_containers],
                "reason": "Частое переполнение контейнеров"
            })
        
        # Find underutilized containers
        underutilized = [c for c in active_containers if c.sensor_data.fill_percent <= 20]
        if len(underutilized) > len(active_containers) * 0.3:
            suggestions.append({
                "type": "relocation",
                "containers": [c.id for c in underutilized[:3]],
                "reason": "Низкая утилизация контейнеров"
            })
        
        return suggestions
    
    def _calculate_average_fill(self, containers: List[Container]) -> float:
        """Calculate average fill percentage across containers"""
        if not containers:
            return 0.0
        total_fill = sum(c.sensor_data.fill_percent for c in containers)
        return round(total_fill / len(containers), 1)
    
    def _get_containers_needing_collection(self, containers: List[Container]) -> List[Dict[str, Any]]:
        """Get containers that need immediate collection"""
        return [
            {
                "id": c.id,
                "fill_percent": c.sensor_data.fill_percent,
                "address": c.address
            }
            for c in containers if c.sensor_data.fill_percent >= 70
        ]
    
    def _get_hardware_alerts(self, containers: List[Container]) -> List[Dict[str, Any]]:
        """Get containers with hardware issues"""
        alerts = []
        for c in containers:
            issues = []
            if c.sensor_data.battery_status != "норм.":
                issues.append("battery")
            if c.sensor_data.tilt_status != "норм.":
                issues.append("tilt")
            
            if issues:
                alerts.append({
                    "container_id": c.id,
                    "issues": issues,
                    "address": c.address
                })
        
        return alerts