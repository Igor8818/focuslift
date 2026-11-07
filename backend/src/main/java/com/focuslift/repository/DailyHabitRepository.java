package com.focuslift.repository;

import com.focuslift.domain.model.DailyHabit;
import com.focuslift.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DailyHabitRepository extends JpaRepository<DailyHabit, Long> {
    Optional<DailyHabit> findByUserAndDate(User user, String date);
    List<DailyHabit> findByUserOrderByDateDesc(User user);
    List<DailyHabit> findByUserAndDateGreaterThanEqualOrderByDateAsc(User user, String fromDate);
}
