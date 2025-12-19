import pytest
from hypothesis import given, strategies as st

# Example property-based test setup for ML service
class TestPropertyExamples:
    
    @given(st.text())
    def test_string_length_property(self, text):
        """Property: string length is always non-negative"""
        assert len(text) >= 0
    
    @given(st.lists(st.integers()))
    def test_list_reverse_property(self, lst):
        """Property: reversing a list twice gives the original list"""
        reversed_once = list(reversed(lst))
        reversed_twice = list(reversed(reversed_once))
        assert reversed_twice == lst
    
    @given(st.integers(min_value=0, max_value=100))
    def test_percentage_bounds(self, percentage):
        """Property: percentage values should be within valid bounds"""
        assert 0 <= percentage <= 100