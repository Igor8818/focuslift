package com.focuslift.repository;

import com.focuslift.domain.model.Routine;
import com.focuslift.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoutineRepository extends JpaRepository<Routine, Long> {
    List<Routine> findByUserOrderByNameAsc(User user);

    Optional<Routine> findByUserAndClientUuid(User user, String clientUuid);

    @Query("SELECT DISTINCT r FROM Routine r LEFT JOIN FETCH r.exercises WHERE r.user = :user ORDER BY r.name ASC")
    List<Routine> findAllWithExercises(@Param("user") User user);
}
