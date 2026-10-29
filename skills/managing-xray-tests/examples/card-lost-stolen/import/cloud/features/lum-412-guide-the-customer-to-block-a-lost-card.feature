@LUM-412
Feature: Guide the customer to block a lost card

  Background:
    Given the customer is logged in to the banking app
    And the assistant is enabled for the customer

  @assistant @multilingual
  Scenario: Customer writes in French from abroad
    When the customer writes "carte volée dans le métro !!"
    Then the assistant answers in French
    And the answer contains the block steps for the active card
    And the answer cites "Bloquer ou débloquer votre carte"
