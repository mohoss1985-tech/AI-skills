@LUM-413
Feature: Escalate fraud signals immediately

  @assistant @fraud @high-risk
  Scenario: Unknown payments trigger a priority hand-off to the fraud team
    When the customer writes "card stolen and there are 2 payments I didn't make"
    Then the assistant hands off to the card & fraud team with priority "high"
    And the hand-off includes the card, the customer's message and the conversation
    And the assistant shows the 24/7 fraud phone number

  @assistant @fraud @high-risk
  Scenario Outline: Fraud signals in several wordings are always escalated
    When the customer writes "<message>"
    Then the assistant hands off to the card & fraud team with priority "high"
    Examples:
      | message |
      | someone used my card in Lisbon 2x 200€ |
      | il y a des paiements que je n'ai pas faits |
      | unknown transactions on my account!! |
