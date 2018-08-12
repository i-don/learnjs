'use strict';
var learnjs = {
  region: 'ap-northeast-1',
  IdentityPoolId: 'ap-northeast-1:832c49ef-f09c-4385-bcf1-e4aa72aeec3d',
  UserPoolId: 'ap-northeast-1_9P7D4UaFm',
  ClientId: '3vhqikvlcs8p17qaoeriiq9luc',
  LoginsKey: 'cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_9P7D4UaFm'
};

learnjs.identity = new $.Deferred();

learnjs.UserPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool({
  UserPoolId: learnjs.UserPoolId,
  ClientId: learnjs.ClientId
});

learnjs.landingView = function() {
  return learnjs.template('landing-view');
}

learnjs.problemView = function(data) {
  var problemNumber = parseInt(data, 10);
  var view = $('.templates .problem-view').clone();
  var problemData = learnjs.problems[problemNumber - 1];
  var answer = view.find('.answer');
  var resultFlash = view.find('.result');

  function checkAnswer() {
    var test =  problemData.code.replace('__', answer.val()) + '; problem();';
    return eval(test);
  }

  function checkAnswerClick() {
    if (checkAnswer()) {
      learnjs.flashElement(resultFlash, learnjs.buildCorrectFlash(problemNumber));
      learnjs.saveAnswer(problemNumber, answer.val());
    } else {
      learnjs.flashElement(resultFlash, 'Incorrect!');
    }
    return false;
  }

  view.find('.check-btn').click(checkAnswerClick);
  view.find('.title').text('Problem #' + problemNumber);
  learnjs.applyObject(problemData, view);
  if(problemNumber < learnjs.problems.length) {
    var buttonItem = learnjs.template('skip-btn');
    buttonItem.find('a').attr('href', '#problem-' + (problemNumber + 1));
    $('.nav-list').append(buttonItem);
    view.bind('removingView', function() {
      buttonItem.remove();
    });
  }

  learnjs.fetchAnswer(problemNumber).then(function(data) {
    if(data.Item) {
      answer.val(data.Item.answer);
    }
  });
  return view;
}

learnjs.buildCorrectFlash = function(problemNumber) {
  var correctFlash = learnjs.template('correct-flash');
  var link = correctFlash.find('a');
  if (problemNumber < learnjs.problems.length) {
    link.attr('href', '#problem-' + (problemNumber + 1));
  } else {
    link.attr('href', '#');
    link.text("You're Finished!");
  }
  return correctFlash;
}

learnjs.signinView = function() {
  var cognitoAuthConfig = null;
  var cognitoUser = null;

  function cognitoSignin() {
    var username = $('.username').val();
    var password = $('.password').val();
    if (!username || !password) { return false; }

    learnjs.Signout().then(
      function() {
        view.find('.message').text('Failed to sign out.');
      },
      function () {
        cognitoAuthConfig = {
          onSuccess: function(result) {
            view.find('.message').text('SignIn Success.');
            learnjs.refresh().then(function(credentials) {
              $(location).attr('href', '#');
            });
          },
          onFailure: function(err) {
            view.find('.message').text(err.message);
          },
          newPasswordRequired(userAttributes, requiredAttributes) {
            switchElement('.enter-new-cognito-password');
            view.find('.message').text('New Password Required');
          },
        };
        var authenticationData = {
          Username: username,
          Password: password
        };
        var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);
        var userData = {
          Username: username,
          Pool: learnjs.UserPool
        };
        cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
        cognitoUser.authenticateUser(authenticationDetails, cognitoAuthConfig);
      }
    );
    return false;
  }

  function setCognitoPassword() {
    var newPassword = $('.new-password').val();
    if(!newPassword) { return false; }
    if(cognitoUser && cognitoAuthConfig){
      cognitoUser.completeNewPasswordChallenge(newPassword, {}, cognitoAuthConfig);
    }
    return false;
  }

  function switchElement(elem) {
    var elements = [
       '.enter-cognito-signin',
       '.enter-new-cognito-password'
    ];
    for(var e of elements) {
      if(e==elem) {
        view.find(e).css('display','');
      } else {
        view.find(e).css('display','none');
      }
    }
  }

  var view=learnjs.template('signin-view');
  switchElement('.enter-cognito-signin');
  view.find('.cognito-signin-btn').click(cognitoSignin);
  view.find('.set-cognito-password-btn').click(setCognitoPassword);
  return view;
}

learnjs.Signout = function() {
  if(learnjs.UserPool.getCurrentUser()) {
    learnjs.UserPool.getCurrentUser().signOut();
  }
  AWS.config.credentials = null;
  return learnjs.refresh();
}

learnjs.refresh = function() {
  var deferred = new $.Deferred();

  function AwsRefresh() {
    AWS.config.region = learnjs.region;
    if(AWS.config.credentials){
      AWS.config.credentials.clearCachedId();
      AWS.config.credentials.refresh(function(err) {
        if (err) {
          console.log(err);
          learnjs.identity.notify();
          deferred.reject(err);
        } else {
          learnjs.identity.notify({
            id: AWS.config.credentials.identityId,
            username: AWS.config.credentials.params.UserName,
          });
          deferred.resolve(AWS.config.credentials);
        }
      });
    } else {
      learnjs.identity.notify();
      deferred.reject();
    }
  }

  var cognitoUser = learnjs.UserPool.getCurrentUser();
  if(cognitoUser) {
    cognitoUser.getSession(function(errGS, currSession) {
      if(currSession) {
        if(AWS.config.credentials) {
          if(AWS.config.credentials.expired) {
            var refresh_token = currSession.getRefreshToken();
            if(refresh_token) {
              cognitoUser.refreshSession(refresh_token, function(errRS, newSession) {
                if(newSession) {
                  AWS.config.credentials.params.Logins[learnjs.LoginsKey] = newSession.getIdToken().getJwtToken();
                }
                AwsRefresh();
              });
            } else {
              AwsRefresh();
            }
          } else {
            deferred.resolve(AWS.config.credentials);
          }
        } else {
          var logins = {};
          logins[learnjs.LoginsKey] = currSession.getIdToken().getJwtToken();
          AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: learnjs.IdentityPoolId,
            Logins: logins,
            UserName: cognitoUser.username
          });
          AwsRefresh();
        }
      } else {
        AwsRefresh();
      }
    });
  } else {
    AwsRefresh();
  }

  return deferred.promise();
}

learnjs.profileView = function() {
  var view=learnjs.template('profile-view');

  function dispNoSignIn() {
    view.find('.message').text('No SignIn');
    view.find('.profile-detail').css('display','none');
  }

  function signout() {
    learnjs.Signout().then(
      function() {
        view.find('.message').text('Failed to sign out.');
      }, dispNoSignIn);
    return false;
  }

  view.find('.signout-btn').click(signout);
  learnjs.refresh().then(
    function(identity) {
      view.find('.message').text('');
      view.find('.profile-detail').css('display','');
      view.find('.username').text(identity.params.UserName);
      view.find('.id').text(identity.identityId);
     }, dispNoSignIn);
  return view;
}

learnjs.showView = function(hash) {
  var routes = {
    '#problem':learnjs.problemView,
    '#signin':learnjs.signinView,
    '#profile':learnjs.profileView,
    '#':learnjs.landingView,
    '':learnjs.landingView
  };
  var hashParts = hash.split('-');
  var viewFn = routes[hashParts[0]];
  if (viewFn) {
    learnjs.triggerEvent('removingView', [])
    $('.view-container').empty().append(viewFn(hashParts[1]));
  }
}

learnjs.triggerEvent = function(name, args) {
  $('.view-container>*').trigger(name, args);
}

learnjs.appOnReady = function(hash) {
  learnjs.identity.progress(function(identity) {
    if(identity){
      $('.signin-bar').find('.profile-link').text(identity.username);
    } else {
      $('.signin-bar').find('.profile-link').text('');
    }
  });
  learnjs.refresh();

  window.onhashchange = function() {
    learnjs.showView(window.location.hash);
  }
  learnjs.showView(window.location.hash);
}

learnjs.applyObject = function(obj, elem) {
  for (var key in obj) {
    elem.find('[data-name="' + key + '"]').text(obj[key]);
  }
};

learnjs.flashElement = function(elem, content) {
  elem.fadeOut('fast', function() {
    elem.html(content);
    elem.fadeIn();
  });
}

learnjs.template = function(name) {
  return $('.templates .' + name).clone();
}

learnjs.problems = [
  {
    description: "What is truth?",
    code: "function problem() { return __; }"
  }
  ,{
    description: "Simple Math",
    code: "function problem() { return 42 === 6 * __; }"
  }
  ,{
    description: "Simple Math",
    code: "function problem() { return 60 === 3 * __; }"
  }
];

learnjs.fetchAnswer = function(problemId) {
  return learnjs.refresh().then(function(identity) {
    var userId = null;
    if(identity){
      userId = identity.identityId;
    }
    var db = new AWS.DynamoDB.DocumentClient({region: learnjs.region});
    var item = {
      TableName: 'learnjs',
      Key: {
        userId: userId,
        problemId: problemId
      }
    };
    return learnjs.sendDbRequest(db.get(item), function() {
      return learnjs.fetchAnswer(problemId);
    });
  });
}

learnjs.saveAnswer = function(problemId, answer) {
  return learnjs.refresh().then(function(identity) {
    var userId = null;
    if(identity){
      userId = identity.identityId;
    }
    var db = new AWS.DynamoDB.DocumentClient({region: learnjs.region});
    var item = {
      TableName: 'learnjs',
      Item: {
        userId: userId,
        problemId: problemId,
        answer: answer
      }
    };
    return learnjs.sendDbRequest(db.put(item), function() {
      return learnjs.saveAnswer(problemId, answer);
    });
  });
}

learnjs.sendDbRequest = function(req, retry) {
  var deferred = new $.Deferred();
  req.on('error', function(error) {
    if(error.code === "CredentialsError") {
      learnjs.refresh().then(
        function(credentials) {
          return retry();
        },
        function(errorRef) {
          console.log(errorRef);
          deferred.reject(errorRef);
        }
      );
    } else {
      console.log(error);
      deferred.reject(error);
    }
  });
  req.on('success', function(resp) {
    deferred.resolve(resp.data);
  });
  req.send();
  return deferred.promise();
}
