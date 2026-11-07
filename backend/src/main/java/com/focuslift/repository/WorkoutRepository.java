package com.focuslift.repository;

import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkoutRepository extends JpaRepository<Workout, Long> {
    List<Workout> findByUserOrderByDateDesc(User user);

    Optional<Workout> findByUserAndClientUuid(User user, String clientUuid);

    @Query("SELECT DISTINCT w FROM Workout w LEFT JOIN FETCH w.exercises WHERE w.user = :user AND w.date >= :fromDate ORDER BY w.date ASC")
    List<Workout> findRecentWorkoutsWithDetails(@Param("user") User user, @Param("fromDate") String fromDate);

    @Query("SELECT DISTINCT w FROM Workout w LEFT JOIN FETCH w.exercises WHERE w.user = :user ORDER BY w.date DESC")
    List<Workout> findAllWorkoutsWithDetails(@Param("user") User user);
}
